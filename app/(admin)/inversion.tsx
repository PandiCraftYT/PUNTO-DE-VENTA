import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import CustomHeader from '../../components/CustomHeader';
import FooterNav from '../../components/FooterNav';

const LOGO_BLUE = '#0056FF';

export default function InversionScreen() {
  const [cargando, setCargando] = useState(true);
  const [totalInvertido, setTotalInvertido] = useState(0);
  const [gananciaEsperada, setGananciaEsperada] = useState(0);
  const [totalProductos, setTotalProductos] = useState(0);

  useEffect(() => {
    calcularInversion();
  }, []);

  const calcularInversion = async () => {
    setCargando(true);
    try {
      // Traemos todos los productos físicos (ignoramos los servicios)
      const { data, error } = await supabase
        .from('productos')
        .select('stock, precio_costo, precio_venta, categoria')
        .neq('categoria', 'SERVICIO');

      if (error) throw error;

      if (data) {
        let invertido = 0;
        let ganancia = 0;
        let cantidad = 0;

        data.forEach(item => {
          const stock = parseInt(item.stock) || 0;
          const costo = parseFloat(item.precio_costo) || 0;
          const venta = parseFloat(item.precio_venta) || 0;

          if (stock > 0) {
            invertido += (costo * stock);
            ganancia += ((venta - costo) * stock);
            cantidad += stock;
          }
        });

        setTotalInvertido(invertido);
        setGananciaEsperada(ganancia);
        setTotalProductos(cantidad);
      }
    } catch (error) {
      console.log("Error al calcular inversión:", error);
    } finally {
      setCargando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <CustomHeader title="INVERSIÓN REAL" />
      
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerBox}>
          <Text style={styles.headerTitle}>Capital en Mercancía</Text>
          <Text style={styles.headerSub}>Valor total de tu inventario actual</Text>
        </View>

        {cargando ? (
          <ActivityIndicator size="large" color={LOGO_BLUE} style={{ marginTop: 50 }} />
        ) : (
          <>
            {/* TARJETA 1: INVERSIÓN TOTAL (LO QUE TE COSTÓ) */}
            <View style={[styles.card, { borderTopColor: '#e74c3c', borderTopWidth: 4 }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="cash" size={24} color="#e74c3c" />
                <Text style={styles.cardTitle}>Dinero Invertido (Costo)</Text>
              </View>
              <Text style={styles.amountText}>${totalInvertido.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</Text>
              <Text style={styles.cardDesc}>Dinero que pagaste por la mercancía física que tienes actualmente.</Text>
            </View>

            {/* TARJETA 2: GANANCIA ESPERADA (UTILIDAD) */}
            <View style={[styles.card, { borderTopColor: '#2ecc71', borderTopWidth: 4 }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="trending-up" size={24} color="#2ecc71" />
                <Text style={styles.cardTitle}>Ganancia Esperada (Utilidad)</Text>
              </View>
              <Text style={styles.amountText}>${gananciaEsperada.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</Text>
              <Text style={styles.cardDesc}>Dinero libre (ganancia) que te quedará al vender todo este stock.</Text>
            </View>

            {/* TARJETA 3: VALOR TOTAL DE VENTA */}
            <View style={[styles.card, { borderTopColor: LOGO_BLUE, borderTopWidth: 4 }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="storefront" size={24} color={LOGO_BLUE} />
                <Text style={styles.cardTitle}>Valor Total en Tienda</Text>
              </View>
              <Text style={[styles.amountText, { color: LOGO_BLUE }]}>${(totalInvertido + gananciaEsperada).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</Text>
              <Text style={styles.cardDesc}>Lo que vale tu inventario a precio de venta al público.</Text>
            </View>

            <View style={styles.statsRow}>
              <Ionicons name="cube" size={20} color="#94a3b8" />
              <Text style={styles.statsText}> Tienes un total de {totalProductos} artículos físicos en stock.</Text>
            </View>
          </>
        )}
      </ScrollView>
      <FooterNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  content: { padding: 20, paddingBottom: 100 },
  headerBox: { marginBottom: 20 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#1e293b' },
  headerSub: { fontSize: 14, color: '#64748b', marginTop: 5 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 15, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#64748b', marginLeft: 8, textTransform: 'uppercase' },
  amountText: { fontSize: 36, fontWeight: '900', color: '#1e293b' },
  cardDesc: { fontSize: 12, color: '#94a3b8', marginTop: 8 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  statsText: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold' }
});