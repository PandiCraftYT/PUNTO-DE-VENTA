import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, ActivityIndicator, RefreshControl, Platform, StatusBar, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

// COLORES DEL SISTEMA
const LOGO_BLUE = '#0056FF';
const SUCCESS_GREEN = '#2ecc71';
const EXPENSE_RED = '#e74c3c';
const NEGATIVE_RED = '#ff4d4f'; 
const CARD_BG = '#fff';
const SCREEN_BG = '#f6f7fb';

export default function InversionScreen() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [totalInvertido, setTotalInvertido] = useState(0);
  const [gananciaEsperada, setGananciaEsperada] = useState(0);
  const [totalProductos, setTotalProductos] = useState(0);
  const [margenGlobal, setMargenGlobal] = useState(0);
  const [topCategorias, setTopCategorias] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);

  // Constante para meta de capital (valor estático para el ejemplo)
  const CAPITAL_GOAL = 30000;

  useEffect(() => {
    calcularInversion();
  }, []);

  const calcularInversion = async () => {
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('nombre, stock, precio_costo, precio_venta, categoria')
        .neq('categoria', 'SERVICIO');

      if (error) throw error;

      if (data) {
        let invertido = 0;
        let ganancia = 0;
        let cantidad = 0;
        let desgloseCategoriasData: any = {};
        const lowStockProductsCollected: any[] = [];

        data.forEach(item => {
          const stock = parseInt(item.stock) || 0;
          const costo = parseFloat(item.precio_costo) || 0;
          const venta = parseFloat(item.precio_venta) || 0;
          const categoria = item.categoria?.trim() || 'General';

          if (stock > 0) {
            const costoTotalItem = costo * stock;
            const gananciaItem = (venta - costo) * stock;
            const stockItem = stock;

            invertido += costoTotalItem;
            ganancia += gananciaItem;
            cantidad += stockItem;

            if (!desgloseCategoriasData[categoria]) {
              desgloseCategoriasData[categoria] = { monto: 0, ganancia: 0, stock: 0 };
            }
            desgloseCategoriasData[categoria].monto += costoTotalItem;
            desgloseCategoriasData[categoria].ganancia += gananciaItem;
            desgloseCategoriasData[categoria].stock += stockItem;
          }

          if (stock < 3 && item.categoria?.trim().toUpperCase() !== 'SERVICIO') {
            lowStockProductsCollected.push({
              nombre: item.nombre,
              categoria: item.categoria,
              stock: stock,
              precio_costo: parseFloat(item.precio_costo) || 0,
            });
          }
        });

        const categoriasOrdenadas = Object.keys(desgloseCategoriasData)
          .map(cat => ({
            nombre: cat,
            monto: desgloseCategoriasData[cat].monto,
            ganancia: desgloseCategoriasData[cat].ganancia,
            stock: desgloseCategoriasData[cat].stock,
            margen: desgloseCategoriasData[cat].monto > 0 ? (desgloseCategoriasData[cat].ganancia / desgloseCategoriasData[cat].monto) * 100 : 0,
          }))
          .sort((a, b) => b.monto - a.monto);

        lowStockProductsCollected.sort((a, b) => a.stock - b.stock);

        setTotalInvertido(invertido);
        setGananciaEsperada(ganancia);
        setTotalProductos(cantidad);
        setMargenGlobal(invertido > 0 ? (ganancia / invertido) * 100 : 0);
        setTopCategorias(categoriasOrdenadas);
        setLowStockProducts(lowStockProductsCollected);
      }
    } catch (error) {
      console.log("Error al calcular inversión:", error);
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    calcularInversion();
  }, []);

  const formatoMoneda = (valor: number) => {
    return '$' + valor.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const getRoiBadgeColor = (margen: number) => {
    if (margen > 0) return SUCCESS_GREEN;
    if (margen === 0) return '#94a3b8'; 
    return NEGATIVE_RED; 
  };

  const getRoiBadgeBackgroundColor = (margen: number) => {
    if (margen > 0) return '#dcfce7'; 
    if (margen === 0) return '#f1f5f9'; 
    return '#fef2f2'; 
  };

  const capitalGoalProgress = totalInvertido > 0 ? (totalInvertido / CAPITAL_GOAL) * 100 : 0;
  const maxInversionCategory = Math.max(...topCategorias.map(c => c.monto), 1); // Añadido ,1 para evitar división por 0

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={26} color="#333" />
          <Text style={styles.backText}>Atrás</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[LOGO_BLUE]} />
        }
      >
        <View style={styles.introBox}>
          <Text style={styles.introTitle}>Capital en Mercancía</Text>
          <Text style={styles.introSub}>Desliza hacia abajo para actualizar los datos</Text>
        </View>

        {cargando && !refreshing ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color={LOGO_BLUE} />
            <Text style={{ marginTop: 10, color: '#94a3b8' }}>Calculando inventario...</Text>
          </View>
        ) : (
          <>
            <View style={[styles.card, styles.cardRedTop]}>
              <View style={styles.cardHeader}>
                <Ionicons name="cash" size={24} color={EXPENSE_RED} />
                <Text style={styles.cardTitle}>Dinero Invertido (Costo)</Text>
              </View>
              <Text style={styles.amountText}>{formatoMoneda(totalInvertido)}</Text>
              <Text style={styles.cardDesc}>Dinero que pagaste por la mercancía física que tienes actualmente.</Text>
            </View>

            <View style={[styles.card, styles.cardGreenTop]}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="trending-up" size={24} color={SUCCESS_GREEN} />
                  <Text style={styles.cardTitle}>Ganancia Esperada</Text>
                </View>
                <View style={[styles.badgeRoi, { backgroundColor: getRoiBadgeBackgroundColor(margenGlobal) }]}>
                  <Text style={[styles.badgeRoiText, { color: getRoiBadgeColor(margenGlobal) }]}>
                    {margenGlobal >= 0 ? '+' : ''}{margenGlobal.toFixed(1)}% ROI
                  </Text>
                </View>
              </View>
              <Text style={styles.amountText}>{formatoMoneda(gananciaEsperada)}</Text>
              <Text style={styles.cardDesc}>Dinero libre (utilidad) que te quedará al vender todo este stock.</Text>
            </View>

            <View style={[styles.card, styles.cardBlueTop]}>
              <View style={styles.cardHeader}>
                <Ionicons name="storefront" size={24} color={LOGO_BLUE} />
                <Text style={styles.cardTitle}>Valor Total en Tienda</Text>
              </View>
              <Text style={[styles.amountText, { color: LOGO_BLUE }]}>
                {formatoMoneda(totalInvertido + gananciaEsperada)}
              </Text>
              
              <View style={styles.barContainer}>
                <View style={[styles.barSegment, { flex: totalInvertido, backgroundColor: EXPENSE_RED }]} />
                <View style={[styles.barSegment, { flex: gananciaEsperada, backgroundColor: SUCCESS_GREEN }]} />
              </View>
              <View style={styles.barLabelsRow}>
                <Text style={styles.barLabelText}>
                  Costo ({(totalInvertido / (totalInvertido + gananciaEsperada) * 100 || 0).toFixed(0)}%)
                </Text>
                <Text style={styles.barLabelText}>
                  Ganancia ({(gananciaEsperada / (totalInvertido + gananciaEsperada) * 100 || 0).toFixed(0)}%)
                </Text>
              </View>

              <Text style={styles.cardDesc}>Lo que vale tu inventario a precio de venta al público.</Text>
            </View>

            <View style={styles.stockStatRow}>
              <Ionicons name="cube" size={20} color="#64748b" />
              <Text style={styles.stockStatText}>
                Tienes un total de {totalProductos} artículos físicos en stock.
              </Text>
            </View>

            {topCategorias.length > 0 && (
              <View style={styles.desgloseCategoriasBox}>
                <Text style={styles.desgloseTitulo}>Inversión por Categoría</Text>
                <Text style={styles.desgloseSub}>¿En dónde está atorado tu dinero y cuánto rinde?</Text>
                
                {topCategorias.map((cat, index) => {
                  // Calculamos el ancho y lo forzamos a ser un string con '%' para evitar errores de TS
                  const widthPercent = `${(cat.monto / maxInversionCategory) * 100}%`;
                  
                  return (
                  <View key={index} style={styles.desgloseRow}>
                    <View style={styles.desgloseHeaderRow}>
                      <View style={styles.desgloseNombreCont}>
                        <View style={styles.desglosePuntoColor} />
                        <Text style={styles.desgloseNombre}>{cat.nombre}</Text>
                      </View>
                      <Text style={styles.desgloseMonto}>{formatoMoneda(cat.monto)}</Text>
                    </View>
                    
                    <View style={styles.desgloseBarCont}>
                      <View 
                        style={[
                          styles.desgloseBarProgress, 
                          // Pasamos el ancho como string explícitamente y usamos 'as any' para calmar a TS
                          { width: widthPercent as any } 
                        ]} 
                      />
                    </View>
                    
                    <View style={styles.desgloseFooterRow}>
                      <Text style={styles.desgloseStockText}>Stock: {cat.stock} pz.</Text>
                      <View style={[styles.desgloseBadgeRoi, { backgroundColor: getRoiBadgeBackgroundColor(cat.margen) }]}>
                        <Text style={[styles.desgloseBadgeRoiText, { color: getRoiBadgeColor(cat.margen) }]}>
                          {cat.margen >= 0 ? '+' : ''}{cat.margen.toFixed(1)}% ROI
                        </Text>
                      </View>
                    </View>
                  </View>
                  )
                })}
              </View>
            )}

            {lowStockProducts.length > 0 && (
              <View style={[styles.card, styles.cardYellowTop]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="warning" size={24} color={NEGATIVE_RED} />
                  <Text style={[styles.cardTitle, { color: NEGATIVE_RED }]}>Alerta de Bajo Stock</Text>
                </View>
                <View style={styles.divisorAlerta} />
                {lowStockProducts.slice(0, 5).map((p, i) => (
                  <View key={i} style={styles.alertaItemRow}>
                    <View style={styles.alertaItemCont}>
                      <Text style={styles.alertaItemNombre} numberOfLines={1}>{p.nombre}</Text>
                      <Text style={styles.alertaItemCat} numberOfLines={1}>{p.categoria}</Text>
                    </View>
                    <View style={styles.alertaItemStockCont}>
                      <Text style={styles.alertaItemStockVal}>{p.stock} pz.</Text>
                      <Text style={styles.alertaItemStockLabel}>Stock</Text>
                    </View>
                  </View>
                ))}
                {lowStockProducts.length > 5 && (
                  <Text style={styles.verMasAlertaText}>+ {lowStockProducts.length - 5} productos más...</Text>
                )}
              </View>
            )}

            <View style={[styles.card, styles.cardGreyTop]}>
              <View style={styles.cardHeader}>
                <Ionicons name="wallet" size={22} color="#94a3b8" />
                <Text style={[styles.cardTitle, { color: '#94a3b8' }]}>Meta de Capital Invertido</Text>
              </View>
              <View style={styles.metaCifrasRow}>
                <Text style={styles.metaCifraVal}>{formatoMoneda(totalInvertido)}</Text>
                <Text style={styles.metaCifraLabel}> Actual / {formatoMoneda(CAPITAL_GOAL)} Meta</Text>
              </View>
              <View style={styles.metaBarCont}>
                <View 
                  style={[
                    styles.metaBarProgress, 
                    // Calculamos y pasamos el string explicitamente
                    { width: `${Math.min(capitalGoalProgress, 100)}%` as any }
                  ]} 
                />
              </View>
              <Text style={styles.metaDesc}>Inversión actual vs. capital de meta predefinida.</Text>
            </View>
            
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SCREEN_BG },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 20 : 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    fontWeight: '700',
    color:"#333",
    marginLeft: 8,
  },
  content: { padding: 20, paddingBottom: 50 },
  introBox: { marginBottom: 20 },
  introTitle: { fontSize: 24, fontWeight: '900', color: '#1e293b' },
  introSub: { fontSize: 13, color: '#94a3b8', marginTop: 5 },
  loadingCenter: { alignItems: 'center', marginTop: 50 },
  
  card: { backgroundColor: CARD_BG, padding: 20, borderRadius: 16, marginBottom: 15, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8 },
  cardRedTop: { borderTopColor: EXPENSE_RED, borderTopWidth: 4 },
  cardGreenTop: { borderTopColor: SUCCESS_GREEN, borderTopWidth: 4 },
  cardBlueTop: { borderTopColor: LOGO_BLUE, borderTopWidth: 4 },
  cardYellowTop: { borderTopColor: NEGATIVE_RED, borderTopWidth: 4 },
  cardGreyTop: { borderTopColor: '#94a3b8', borderTopWidth: 4, elevation: 1 },

  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: '#64748b', marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  amountText: { fontSize: 34, fontWeight: '900', color: '#1e293b' },
  cardDesc: { fontSize: 12, color: '#94a3b8', marginTop: 12, lineHeight: 18 },
  
  badgeRoi: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeRoiText: { fontWeight: 'bold', fontSize: 12 },
  
  barContainer: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 15, marginBottom: 5, backgroundColor: '#f1f5f9' },
  barSegment: { height: '100%' },
  barLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  barLabelText: { fontSize: 10, color: '#94a3b8', fontWeight: 'bold' },

  stockStatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 5, marginBottom: 25, backgroundColor: CARD_BG, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  stockStatText: { color: '#64748b', fontSize: 13, fontWeight: '600', marginLeft: 5 },

  desgloseCategoriasBox: { backgroundColor: CARD_BG, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20 },
  desgloseTitulo: { fontSize: 16, fontWeight: '900', color: '#1e293b' },
  desgloseSub: { fontSize: 12, color: '#94a3b8', marginBottom: 15, marginTop: 2 },
  desgloseRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  desgloseHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  desgloseNombreCont: { flexDirection: 'row', alignItems: 'center' },
  desglosePuntoColor: { width: 8, height: 8, borderRadius: 4, backgroundColor: LOGO_BLUE, marginRight: 10 },
  desgloseNombre: { fontSize: 14, color: '#334155', fontWeight: '600' },
  desgloseMonto: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  
  desgloseBarCont: { height: 6, borderRadius: 3, backgroundColor: '#f1f5f9', overflow: 'hidden', marginBottom: 8 },
  desgloseBarProgress: { height: '100%', backgroundColor: LOGO_BLUE, borderRadius: 3 },
  
  desgloseFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  desgloseStockText: { fontSize: 11, color: '#94a3b8', fontWeight: 'bold' },
  desgloseBadgeRoi: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  desgloseBadgeRoiText: { fontWeight: 'bold', fontSize: 10 },

  divisorAlerta: { height: 1, backgroundColor: '#fee2e2', marginVertical: 12, borderStyle: 'dashed' },
  alertaItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#fef2f2' },
  alertaItemCont: { flex: 1, marginRight: 10 },
  alertaItemNombre: { fontSize: 14, color: '#1e293b', fontWeight: '600' },
  alertaItemCat: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  alertaItemStockCont: { alignItems: 'flex-end', minWidth: 60 },
  alertaItemStockVal: { fontSize: 14, fontWeight: '800', color: NEGATIVE_RED },
  alertaItemStockLabel: { fontSize: 10, color: NEGATIVE_RED, opacity: 0.7, fontWeight: 'bold' },
  verMasAlertaText: { fontSize: 12, color: NEGATIVE_RED, opacity: 0.8, fontWeight: 'bold', marginTop: 10, textAlign: 'center' },

  metaCifrasRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  metaCifraVal: { fontSize: 24, fontWeight: '900', color: '#1e293b' },
  metaCifraLabel: { fontSize: 12, color: '#94a3b8', fontWeight: '700', marginLeft: 5, marginBottom: 2 },
  metaBarCont: { height: 10, borderRadius: 5, backgroundColor: '#f1f5f9', overflow: 'hidden', marginBottom: 10 },
  metaBarProgress: { height: '100%', backgroundColor: '#94a3b8', borderRadius: 5 },
  metaDesc: { fontSize: 11, color: '#94a3b8', marginTop: 5, letterSpacing: 0.3 }
});