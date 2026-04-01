// Archivo: lib/pdfGenerator.ts

import { Platform, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatoMoneda } from './helpers';

export const generarReportePDF = async (grupo: any) => {
  try {
    let filasHTML = grupo.datos.map((mov: any) => {
      const esVenta = mov.tipo_registro === 'venta';
      const fechaStr = new Date(mov.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      const tipo = esVenta ? 'INGRESO' : 'EGRESO';
      const detalle = esVenta ? `Atendido por: ${mov.vendedor_nombre || 'Admin'}` : mov.concepto;
      const metodo = esVenta ? mov.metodo_pago : mov.categoria;
      
      const monto = formatoMoneda(esVenta ? mov.total : mov.monto);
      
      const colorClass = esVenta ? 'val-in' : 'val-out';
      const signo = esVenta ? '+' : '-';

      return `
        <tr>
          <td>${fechaStr}</td>
          <td><strong>${tipo}</strong></td>
          <td>${detalle}</td>
          <td>${metodo || '-'}</td>
          <td class="${colorClass}">${signo} ${monto}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Reporte Financiero - Punto de venta</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
            .brand { font-size: 16px; font-weight: bold; color: #94a3b8; letter-spacing: 2px; margin-bottom: 5px; }
            .title { font-size: 28px; font-weight: 900; color: #0056FF; margin-bottom: 5px; }
            .subtitle { font-size: 16px; color: #1e293b; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
            
            .summary { display: flex; justify-content: space-between; margin-bottom: 40px; gap: 15px; }
            .box { padding: 20px; border-radius: 12px; width: 33%; text-align: center; font-weight: bold; }
            .box-in { background-color: #f0fdf4; color: #16a34a; border: 1px solid #dcfce7; }
            .box-out { background-color: #fef2f2; color: #e74c3c; border: 1px solid #fee2e2; }
            .box-net { background-color: #f0f5ff; color: #0056FF; border: 1px solid #dbeafe; }
            .box-title { font-size: 12px; margin-bottom: 8px; letter-spacing: 1px; color: inherit; opacity: 0.9; }
            .box-amount { font-size: 24px; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { padding: 12px 10px; border-bottom: 1px solid #f1f5f9; text-align: left; font-size: 13px; }
            th { background-color: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: bold; border-bottom: 2px solid #e2e8f0; }
            .val-in { color: #16a34a; font-weight: bold; }
            .val-out { color: #e74c3c; font-weight: bold; }
            
            .footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">Punto de venta</div>
            <div class="title">REPORTE FINANCIERO</div>
            <div class="subtitle">PERÍODO: ${grupo.fecha}</div>
          </div>
          
          <div class="summary">
            <div class="box box-in">
              <div class="box-title">TOTAL INGRESOS</div>
              <div class="box-amount">${formatoMoneda(grupo.totalIngresos)}</div>
            </div>
            <div class="box box-out">
              <div class="box-title">TOTAL GASTOS</div>
              <div class="box-amount">${formatoMoneda(grupo.totalEgresos)}</div>
            </div>
            <div class="box box-net">
              <div class="box-title">GANANCIA NETA</div>
              <div class="box-amount">${formatoMoneda(grupo.totalDia)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Movimiento</th>
                <th>Detalle / Concepto</th>
                <th>Método / Categoría</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              ${filasHTML}
            </tbody>
          </table>
          
          <div class="footer">
            Reporte generado automáticamente por el sistema interno el ${new Date().toLocaleDateString('es-MX')} a las ${new Date().toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'})}.<br>
            Culiacán, Sinaloa, México.
          </div>
        </body>
      </html>
    `;

    if (Platform.OS === 'web') {
      // MAGIA PARA LA WEB: Abrimos una ventana nueva limpia, le inyectamos el HTML y mandamos imprimir
      const ventanaImpresion = window.open('', '_blank');
      if (ventanaImpresion) {
        ventanaImpresion.document.write(htmlContent);
        ventanaImpresion.document.close();
        ventanaImpresion.focus();
        
        // Le damos 250 milisegundos para que los estilos carguen bien antes de abrir el diálogo
        setTimeout(() => {
          ventanaImpresion.print();
          ventanaImpresion.close(); // Cerramos la pestaña solita después de imprimir
        }, 250);
      } else {
        Alert.alert("Bloqueo detectado", "Por favor, permite las ventanas emergentes (pop-ups) en tu navegador para generar el PDF.");
      }
    } else {
      // EN CELULARES (iOS y Android): Todo sigue funcionando normal con Expo
      const { uri } = await Print.printToFileAsync({ html: htmlContent, base64: false });
      await Sharing.shareAsync(uri, { 
        UTI: '.pdf', 
        mimeType: 'application/pdf',
        dialogTitle: 'Compartir Reporte PDF'
      });
    }
  } catch (error) {
    Alert.alert("Error", "No se pudo generar el reporte PDF.");
  }
};