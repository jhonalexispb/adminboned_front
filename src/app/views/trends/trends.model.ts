export interface TrendsData {
  years_disponibles: number[];
  year: number;
  meses: {
    mes:          number;
    nombre:       string;
    ventas:       number;
    compras:      number;
    gastos:       number;
    ganancia:     number;
    pedidos:      number;
    meta_mensual: number;
  }[];
  resumen: {
    total_ventas:     number;
    promedio_mensual: number;
    mejor_mes: {
      mes:    number;
      nombre: string;
      ventas: number;
    } | null;
  };
}
