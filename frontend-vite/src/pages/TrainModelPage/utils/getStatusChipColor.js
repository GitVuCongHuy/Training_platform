export const getStatusChipColor = (status) => {
  switch (status) {
    case 'finished':
      return 'success';
    case 'failed':
      return 'error';
    case 'running':
      return 'primary';
    default:
      return 'default';
  }
};