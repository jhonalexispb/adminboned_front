export interface TrendsData {
  years_disponibles: number[];
  year: number;
  month: number | null;
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
  top_clientes: {
    client_id:      number;
    client_name:    string;
    total_comprado: number;
    pedidos:        number;
    top_productos: {
      product_id: number;
      name:       string;
      unidades:   number;
    }[];
  }[];
  tipo_ventas: {
    cliente_catalogo: { total: number; pedidos: number; pct: number };
    vendedor_manual:  { total: number; pedidos: number; pct: number };
  };
}
