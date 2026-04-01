export const formatoMoneda = (valor: number | string) => {
  const numero = Number(valor);
  if (isNaN(numero)) return '$0.00';
  return '$' + numero.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};