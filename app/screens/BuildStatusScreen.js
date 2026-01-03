import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  RefreshControl,
  Linking,
  Animated,
} from 'react-native';
import socketService from '../services/socket';
import { buildsApi, localBuildsApi, githubActionsApi } from '../services/api';

// Build type configuration
const BUILD_TYPES = {
  EAS: {
    id: 'EAS',
    name: 'EAS Cloud',
    description: 'Builds en la nube de Expo',
    icon: '☁️',
    color: '#007AFF',
  },
  LOCAL: {
    id: 'LOCAL',
    name: 'Local VPS',
    description: 'Builds nativos en el VPS',
    icon: '🖥️',
    color: '#4CAF50',
  },
  GITHUB: {
    id: 'GITHUB',
    name: 'GitHub Actions',
    description: 'Builds ilimitados en GitHub',
    icon: '⚡',
    color: '#9333EA',
  },
};

export default function BuildStatusScreen({ route }) {
  const { project } = route.params;
  const [buildType, setBuildType] = useState('EAS');
  const [builds, setBuilds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeBuildId, setActiveBuildId] = useState(null);
  const [buildProgress, setBuildProgress] = useState(null);
  const [buildUrl, setBuildUrl] = useState(null);
  const [buildStartTime, setBuildStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Timer effect - updates every second while build is running
  useEffect(() => {
    if (loading && buildStartTime) {
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - buildStartTime) / 1000);
        setElapsedTime(elapsed);
      }, 1000);

      // Animate progress bar
      Animated.loop(
        Animated.sequence([
          Animated.timing(progressAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          }),
          Animated.timing(progressAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      progressAnim.setValue(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [loading, buildStartTime]);

  // Format seconds to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    loadBuilds();
    initializeSocket();

    return () => {
      // EAS build events
      socketService.off('build:output');
      socketService.off('build:error');
      socketService.off('build:queued');
      socketService.off('build:complete');
      // Local build events
      socketService.off('local-build:started');
      socketService.off('local-build:output');
      socketService.off('local-build:complete');
      socketService.off('local-build:error');
    };
  }, [buildType]); // Reload builds when build type changes

  const initializeSocket = async () => {
    try {
      await socketService.connect();

      // EAS build event listeners
      socketService.on('build:output', handleBuildOutput);
      socketService.on('build:error', handleBuildError);
      socketService.on('build:queued', handleBuildQueued);
      socketService.on('build:complete', handleBuildComplete);

      // Local build event listeners
      socketService.on('local-build:started', handleLocalBuildStarted);
      socketService.on('local-build:output', handleLocalBuildOutput);
      socketService.on('local-build:complete', handleLocalBuildComplete);
      socketService.on('local-build:error', handleLocalBuildError);
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
    }
  };

  const handleBuildOutput = (data) => {
    console.log('Build output:', data);
    updateBuildProgress(data.content);
  };

  const handleBuildError = (data) => {
    const content = data.content?.trim() || '';

    // Filter out progress messages that EAS sends via stderr
    const progressPatterns = [
      /^$/,  // Empty lines
      /^✔/,  // Success checkmarks
      /^-/,  // Progress indicators
      /uploading/i,
      /compressing/i,
      /waiting/i,
      /queued/i,
      /resolved/i,
      /environment/i,
      /fingerprint/i,
      /skipping/i,
      /initialized/i,
      /see logs:/i,
      /start builds sooner/i,
      /sign up for/i,
      /no environment variables/i,
      /no remote versions/i,
      /build is about to start/i,
    ];

    const isProgressMessage = progressPatterns.some(pattern => pattern.test(content));

    if (isProgressMessage) {
      // These are progress messages, not errors
      console.log('Build progress:', content);
      updateBuildProgress(content);
    } else if (content.includes('Error:') || content.includes('error:')) {
      // This is a real error
      console.error('Build error:', data);
      setBuildProgress(`❌ ${content}`);
    } else {
      // Other stderr output, treat as info
      console.log('Build info:', content);
      updateBuildProgress(content);
    }
  };

  const updateBuildProgress = (content) => {
    if (!content?.trim()) return;

    // Extract meaningful status from the content
    if (content.includes('Uploaded to EAS')) {
      setBuildProgress('✅ Uploaded to EAS');
    } else if (content.includes('See logs:')) {
      const urlMatch = content.match(/https:\/\/expo\.dev[^\s]+/);
      if (urlMatch) {
        setBuildUrl(urlMatch[0]);
        setBuildProgress('🔗 Build submitted - tap to view');
      }
    } else if (content.includes('Build queued')) {
      setBuildProgress('⏳ Build queued...');
    } else if (content.includes('Build is about to start')) {
      setBuildProgress('🚀 Build starting...');
    } else if (content.includes('Uploading')) {
      setBuildProgress('📤 Uploading to EAS...');
    } else if (content.includes('Compressing')) {
      setBuildProgress('📦 Compressing project...');
    }
  };

  const handleBuildQueued = (data) => {
    console.log('Build queued:', data);
    setBuildProgress('✅ Build queued on EAS');
    if (data.easBuildId) {
      setBuildUrl(`https://expo.dev/accounts/josejordandev/projects/${project.name}/builds/${data.easBuildId}`);
    }
    loadBuilds();
  };

  const handleBuildComplete = (data) => {
    console.log('Build complete:', data);
    const finalElapsed = elapsedTime;
    setActiveBuildId(null);
    setLoading(false);
    setBuildStartTime(null);
    loadBuilds();

    if (data.code === 0) {
      setBuildProgress(`✅ Build submitted in ${formatTime(finalElapsed)}`);
      Alert.alert(
        '🎉 Build Submitted',
        `Your build has been submitted to EAS Cloud in ${formatTime(finalElapsed)}.\nIt will take 5-15 minutes to complete.`,
        [
          { text: 'OK' },
          buildUrl ? { text: 'View Build', onPress: () => Linking.openURL(buildUrl) } : null,
        ].filter(Boolean)
      );
    } else {
      setBuildProgress(`❌ Build failed after ${formatTime(finalElapsed)}`);
      Alert.alert(
        'Build Failed',
        'Failed to submit build. Check the progress messages for details.'
      );
    }
  };

  // Local build event handlers
  const handleLocalBuildStarted = (data) => {
    console.log('Local build started:', data);
    setBuildProgress('🚀 Local VPS build started...');
  };

  const handleLocalBuildOutput = (data) => {
    console.log('Local build output:', data);
    const { phase, message } = data;

    // Update progress based on phase
    if (phase === 'prebuild') {
      setBuildProgress('📱 Running expo prebuild...');
    } else if (phase === 'gradle') {
      setBuildProgress('🔨 Building with Gradle...');
    } else if (message) {
      // Show the message if it contains useful info
      if (message.includes('BUILD SUCCESSFUL')) {
        setBuildProgress('✅ Gradle build successful!');
      } else if (message.includes('Downloading')) {
        setBuildProgress('📥 Downloading dependencies...');
      } else if (message.includes('Compiling')) {
        setBuildProgress('⚙️ Compiling...');
      } else if (message.includes('Task')) {
        // Extract task name from message like ":app:assembleDebug"
        const taskMatch = message.match(/:[\w:]+/);
        if (taskMatch) {
          setBuildProgress(`🔧 ${taskMatch[0]}`);
        }
      }
    }
  };

  const handleLocalBuildComplete = (data) => {
    console.log('Local build complete:', data);
    const finalElapsed = elapsedTime;
    setActiveBuildId(null);
    setLoading(false);
    setBuildStartTime(null);

    setBuildProgress(`✅ Build completed in ${formatTime(finalElapsed)}`);
    Alert.alert(
      '🎉 Build Complete',
      `Your local VPS build completed successfully in ${formatTime(finalElapsed)}!\n\nAPK: ${data.apkPath}`,
      [
        { text: 'OK' },
        {
          text: 'Download APK',
          onPress: () => {
            if (data.downloadUrl) {
              Linking.openURL(`${data.downloadUrl}`);
            }
          }
        },
      ]
    );

    loadBuilds();
  };

  const handleLocalBuildError = (data) => {
    console.error('Local build error:', data);
    const finalElapsed = elapsedTime;
    setActiveBuildId(null);
    setLoading(false);
    setBuildStartTime(null);

    setBuildProgress(`❌ Build failed after ${formatTime(finalElapsed)}`);
    Alert.alert(
      'Build Failed',
      data.error || 'Local VPS build failed. Check the progress messages for details.'
    );
  };

  const [warning, setWarning] = useState(null);
  const [initializing, setInitializing] = useState(false);

  const loadBuilds = async () => {
    try {
      setRefreshing(true);
      setWarning(null);

      if (buildType === 'GITHUB') {
        // Load GitHub Actions runs
        const response = await githubActionsApi.getRuns(10);
        const runs = response.data.runs || [];

        // Transform GitHub Actions runs to match the build card format
        const transformedRuns = runs.map(run => ({
          id: run.id.toString(),
          platform: 'android',
          status: run.status === 'completed'
            ? (run.conclusion === 'success' ? 'finished' : run.conclusion)
            : run.status === 'in_progress' ? 'in-progress' : run.status,
          buildProfile: `GitHub Actions (#${run.runNumber})`,
          createdAt: run.createdAt,
          logsUrl: run.htmlUrl,
          artifacts: run.conclusion === 'success' ? { buildUrl: run.htmlUrl } : null,
        }));

        setBuilds(transformedRuns);
      } else {
        // Load EAS builds (original logic)
        const response = await buildsApi.list(project.path, 10);

        // Handle both array response and object with builds, warning
        if (Array.isArray(response.data)) {
          setBuilds(response.data);
        } else if (response.data?.builds !== undefined) {
          setBuilds(response.data.builds);
          if (response.data.warning) {
            setWarning(response.data.warning);
          }
        } else {
          setBuilds([]);
        }
      }
    } catch (error) {
      console.error('Error loading builds:', error);
      if (error.response?.status !== 404) {
        Alert.alert('Error', 'Failed to load builds list');
      }
    } finally {
      setRefreshing(false);
    }
  };

  const initEASProject = async () => {
    try {
      setInitializing(true);
      const response = await buildsApi.init(project.path);

      Alert.alert(
        '✅ Proyecto configurado',
        response.data.message || 'Proyecto vinculado a EAS correctamente'
      );

      setWarning(null);
      loadBuilds(); // Reload builds after init
    } catch (error) {
      console.error('Error initializing EAS project:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'No se pudo configurar el proyecto en EAS'
      );
    } finally {
      setInitializing(false);
    }
  };

  const startBuild = async (platform = 'android', profile = 'preview') => {
    if (loading || activeBuildId) {
      Alert.alert('Build in Progress', 'Please wait for the current build to complete');
      return;
    }

    // GitHub Actions doesn't require socket connection
    if (buildType !== 'GITHUB' && !socketService.isConnected()) {
      Alert.alert('Connection Error', 'Not connected to server');
      return;
    }

    const buildConfig = BUILD_TYPES[buildType];

    // GitHub Actions uses different terminology
    const buildTypeLabel = buildType === 'GITHUB'
      ? `Type: ${profile === 'preview' ? 'debug' : 'release'}`
      : `Profile: "${profile}"`;

    Alert.alert(
      'Start Build',
      `Start ${platform} build with ${buildConfig.name}?\n\n${buildTypeLabel}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            try {
              setLoading(true);
              setBuildStartTime(Date.now());
              setElapsedTime(0);
              setBuildProgress(`🚀 Starting ${buildConfig.name} build...`);

              if (buildType === 'GITHUB') {
                // GitHub Actions build
                const buildTypeGH = profile === 'preview' ? 'debug' : 'release';
                const result = await githubActionsApi.buildUserProject(
                  project.name,
                  buildTypeGH
                );

                setLoading(false);
                setBuildProgress(`✅ Build triggered on GitHub Actions`);

                Alert.alert(
                  '🎉 Build Triggered',
                  `Your ${buildTypeGH} build has been queued on GitHub Actions.\n\nIt will take 10-15 minutes to complete.`,
                  [
                    { text: 'OK' },
                    {
                      text: 'View on GitHub',
                      onPress: () => Linking.openURL(result.data.viewUrl)
                    },
                  ]
                );

                // Refresh builds list
                loadBuilds();
              } else {
                // EAS or Local VPS build
                const api = buildType === 'EAS' ? buildsApi : localBuildsApi;
                const result = await api.start(
                  project.path,
                  platform,
                  profile,
                  socketService.getSocketId()
                );
                setActiveBuildId(result.data.buildId);
              }
            } catch (error) {
              console.error('Error starting build:', error);
              Alert.alert(
                'Error',
                error.response?.data?.error || 'Failed to start build'
              );
              setLoading(false);
              setBuildProgress(null);
            }
          },
        },
      ]
    );
  };

  const cancelBuild = async () => {
    if (!activeBuildId) return;

    try {
      await buildsApi.cancel(activeBuildId);
      setActiveBuildId(null);
      setLoading(false);
      Alert.alert('Build Cancelled', 'Build submission has been cancelled');
    } catch (error) {
      console.error('Error cancelling build:', error);
      Alert.alert('Error', 'Failed to cancel build');
    }
  };

  const openBuildUrl = (build) => {
    if (build.logsUrl) {
      Linking.openURL(build.logsUrl);
    } else if (build.id) {
      const url = `https://expo.dev/accounts/${build.project?.ownerAccount?.name}/projects/${build.project?.slug}/builds/${build.id}`;
      Linking.openURL(url);
    }
  };

  const downloadArtifact = (build) => {
    if (build.artifacts?.buildUrl) {
      Linking.openURL(build.artifacts.buildUrl);
    } else {
      Alert.alert('No Artifact', 'This build does not have a downloadable artifact yet');
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'finished':
        return '#4CAF50';
      case 'in-queue':
      case 'in-progress':
        return '#FF9800';
      case 'errored':
      case 'canceled':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'finished':
        return '✅';
      case 'in-queue':
        return '⏳';
      case 'in-progress':
        return '🔄';
      case 'errored':
        return '❌';
      case 'canceled':
        return '🚫';
      default:
        return '⚪';
    }
  };

  const renderBuild = ({ item }) => {
    const statusColor = getStatusColor(item.status);
    const statusIcon = getStatusIcon(item.status);
    const canDownload = item.status?.toLowerCase() === 'finished' && item.artifacts?.buildUrl;

    return (
      <View style={styles.buildCard}>
        <View style={styles.buildHeader}>
          <Text style={styles.buildPlatform}>
            {item.platform === 'android' ? '🤖' : '🍎'} {item.platform?.toUpperCase()}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>
              {statusIcon} {item.status}
            </Text>
          </View>
        </View>

        <Text style={styles.buildId}>Build #{item.id?.substring(0, 8)}</Text>
        <Text style={styles.buildProfile}>Profile: {item.buildProfile || 'preview'}</Text>
        <Text style={styles.buildDate}>
          {new Date(item.createdAt).toLocaleString()}
        </Text>

        <View style={styles.buildActions}>
          <Pressable
            style={styles.actionButton}
            onPress={() => openBuildUrl(item)}
          >
            <Text style={styles.actionButtonText}>View Logs</Text>
          </Pressable>

          {canDownload && (
            <Pressable
              style={[styles.actionButton, styles.downloadButton]}
              onPress={() => downloadArtifact(item)}
            >
              <Text style={styles.actionButtonText}>Download APK</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.projectName}>📦 {project.name}</Text>
      </View>

      {/* Build Type Selector */}
      <View style={styles.buildTypeSelector}>
        <Text style={styles.selectorLabel}>Tipo de Build:</Text>
        <View style={styles.typeButtons}>
          {Object.entries(BUILD_TYPES).map(([key, type]) => (
            <Pressable
              key={key}
              style={[
                styles.typeButton,
                buildType === key && styles.typeButtonActive,
                { borderColor: type.color },
                buildType === key && { backgroundColor: type.color + '15' },
              ]}
              onPress={() => setBuildType(key)}
              disabled={loading}
            >
              <Text style={styles.typeIcon}>{type.icon}</Text>
              <Text
                style={[
                  styles.typeName,
                  buildType === key && { color: type.color, fontWeight: 'bold' },
                ]}
              >
                {type.name}
              </Text>
              <Text style={styles.typeDescription}>{type.description}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.buildButtonsContainer}>
        <Pressable
          style={[
            styles.buildButton,
            { backgroundColor: BUILD_TYPES[buildType].color },
            loading && styles.buildButtonDisabled,
          ]}
          onPress={() => startBuild('android', 'preview')}
          disabled={loading || !!activeBuildId}
        >
          <Text style={styles.buildButtonText}>
            {loading
              ? `⏳ Building with ${BUILD_TYPES[buildType].name}...`
              : `🔨 Build Preview (${buildType === 'EAS' ? 'APK Cloud' : 'APK Local'})`}
          </Text>
        </Pressable>

        {loading && activeBuildId && (
          <Pressable style={styles.cancelButton} onPress={cancelBuild}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        )}

        {buildProgress && (
          <Pressable
            style={styles.progressBanner}
            onPress={() => buildUrl && Linking.openURL(buildUrl)}
          >
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>{buildProgress}</Text>
              {loading && buildStartTime && (
                <Text style={styles.timerText}>⏱️ {formatTime(elapsedTime)}</Text>
              )}
            </View>

            {loading && (
              <View style={styles.progressBarContainer}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
            )}

            {buildUrl && (
              <Text style={styles.progressLink}>Tap to view on EAS →</Text>
            )}
          </Pressable>
        )}
      </View>

      {warning && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>⚠️ {warning}</Text>
          <Pressable
            style={[styles.initButton, initializing && styles.initButtonDisabled]}
            onPress={initEASProject}
            disabled={initializing}
          >
            <Text style={styles.initButtonText}>
              {initializing ? '⏳ Configurando...' : '🔧 Configurar EAS'}
            </Text>
          </Pressable>
        </View>
      )}

      {builds.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No Builds Yet</Text>
          <Text style={styles.emptyText}>
            {warning
              ? 'Configura EAS primero, luego inicia un build'
              : 'Start your first build by tapping the button above'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={builds}
          keyExtractor={(item) => item.id}
          renderItem={renderBuild}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={loadBuilds} />
          }
          contentContainerStyle={styles.buildsList}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  projectName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  buildTypeSelector: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  typeButtonActive: {
    borderWidth: 2,
  },
  typeIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  typeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  typeDescription: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
  },
  buildButtonsContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  buildButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buildButtonDisabled: {
    opacity: 0.5,
  },
  buildButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    marginTop: 8,
    backgroundColor: '#FF3B30',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressBanner: {
    marginTop: 12,
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  progressText: {
    color: '#1565C0',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  timerText: {
    color: '#1565C0',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: '#BBDEFB',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#1976D2',
    borderRadius: 3,
  },
  progressLink: {
    color: '#1976D2',
    fontSize: 12,
    marginTop: 8,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  warningBanner: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFECB5',
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  initButton: {
    backgroundColor: '#856404',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'center',
  },
  initButtonDisabled: {
    opacity: 0.5,
  },
  initButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buildsList: {
    padding: 8,
  },
  buildCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 8,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buildHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  buildPlatform: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  buildId: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  buildProfile: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  buildDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  buildActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  downloadButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
