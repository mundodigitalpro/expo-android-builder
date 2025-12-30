export const validateProjectName = (name) => {
  if (!name || name.trim().length === 0) {
    return 'El nombre del proyecto es requerido';
  }

  if (name.length < 3) {
    return 'El nombre debe tener al menos 3 caracteres';
  }

  if (name.length > 50) {
    return 'El nombre no puede tener más de 50 caracteres';
  }

  const nameRegex = /^[a-zA-Z0-9-_]+$/;
  if (!nameRegex.test(name)) {
    return 'Solo se permiten letras, números, guiones y guiones bajos';
  }

  return null;
};
