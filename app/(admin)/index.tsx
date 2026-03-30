import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView, 
  ScrollView, Platform, ActivityIndicator, RefreshControl 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

import CustomHeader from '../../components/CustomHeader';
import FooterNav from '../../components/FooterNav';
import { useAuth } from '../lib/auth_context'; 

const LOGO_BLUE = '#0056FF';

interface ModuleButtonProps {
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { usuario } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // Estado para el Pull-to-Refresh
  const [ventasHoy, setVentasHoy] = useState<any[]>([]);
  const [totalDinero, setTotalDinero] = useState(0);

  useEffect(() => {
    if (usuario) {
      cargarDatosDashboard();

      const canal = supabase
        .channel('dashboard-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ventas' }, () => {
          cargarDatosDashboard();
        })
        .subscribe();

      return () => { supabase.removeChannel(canal); };
    }
  }, [usuario]);

  const cargarDatosDashboard = async () => {
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('ventas')
        .select('*')
        .gte('created_at', hoy.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setVentasHoy(data);
        const suma = data.reduce((acc, v) => acc + parseFloat(v.total), 0);
        setTotalDinero(suma);
      }
    } catch (err) {
      console.log("Error dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- NUEVA FUNCIÓN: PARA RECARGAR AL DESLIZAR HACIA ABAJO ---
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cargarDatosDashboard();
    setRefreshing(false);
  }, []);

  // --- NUEVA FUNCIÓN: SALUDO DINÁMICO ---
  const obtenerSaludo = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Buenos días';
    if (hora < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const fechaTexto = new Date().toLocaleDateString('es-MX', { 
    weekday: 'long', day: 'numeric', month: 'long' 
  });

  if (!usuario) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={LOGO_BLUE} />
        <Text style={{ marginTop: 10, color: '#94a3b8' }}>Cargando panel...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CustomHeader showLogout={true} />

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[LOGO_BLUE]} />
        }
      >
        
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>
            {obtenerSaludo()}, {usuario?.nombre?.split(' ')[0] || 'Admin'}
          </Text>
          <Text style={styles.dateText}>
            Resumen del {fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1)}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryInfo}>
            <View>
              <Text style={styles.summaryLabel}>Ventas Totales Hoy</Text>
              {/* Le agregamos formato de comas a los miles de forma segura */}
              <Text style={styles.summaryValue}>
                ${totalDinero.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              </Text>
            </View>
            <View style={styles.iconCircle}>
              <Ionicons name="trending-up" size={24} color={LOGO_BLUE} />
            </View>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryFooter}>
            <Text style={styles.footerText}>{ventasHoy.length} tickets generados hoy</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Módulos de Gestión</Text>
        
        <View style={styles.gridContainer}>
          <ModuleButton 
            label="Venta Rápida" 
            description="Punto de venta"
            icon="cart" 
            color="#0056FF" 
            onPress={() => router.push('/(admin)/ventas' as any)} 
          />
          <ModuleButton 
            label="Productos" 
            description="Tu inventario"
            icon="cube" 
            color="#2ecc71" 
            onPress={() => router.push('/(admin)/productos' as any)} 
          />
          <ModuleButton 
            label="Reportes" 
            description="Cortes de caja"
            icon="bar-chart" 
            color="#e67e22" 
            onPress={() => router.push('/(admin)/historial' as any)} 
          />
          <ModuleButton 
            label="Ajustes" 
            description="Configuración"
            icon="settings" 
            color="#8e44ad" 
            onPress={() => alert('Próximamente')} 
          />
        </View>

        <View style={styles.recentActivityHeader}>
          <Text style={styles.sectionTitle}>Actividad Reciente</Text>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }} 
            onPress={() => router.push('/(admin)/historial' as any)}
          >
            <Text style={styles.seeAllText}>Ver todo</Text>
            <Ionicons name="arrow-forward" size={14} color={LOGO_BLUE} style={{ marginLeft: 3 }} />
          </TouchableOpacity>
        </View>
        
        {loading ? (
          <ActivityIndicator color={LOGO_BLUE} style={{ marginTop: 20 }} />
        ) : ventasHoy.length > 0 ? (
          ventasHoy.slice(0, 3).map((venta) => (
            <TouchableOpacity 
              key={venta.id} 
              style={styles.ventaItem}
              onPress={() => router.push('/(admin)/historial' as any)}
            >
              <View style={styles.ventaIcon}>
                <Ionicons name="receipt" size={20} color={LOGO_BLUE} />
              </View>
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={styles.ventaText}>Venta de ${parseFloat(venta.total).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</Text>
                <Text style={styles.ventaHora}>
                  {new Date(venta.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {venta.vendedor_nombre}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="receipt-outline" size={40} color="#cbd5e1" />
            <Text style={styles.emptyStateText}>Aún no hay ventas registradas hoy.</Text>
          </View>
        )}
        
        <View style={{ height: 100 }} />
      </ScrollView>

      <FooterNav />
    </SafeAreaView>
  );
}

function ModuleButton({ label, description, icon, color, onPress }: ModuleButtonProps) {
  return (
    <TouchableOpacity 
      style={styles.moduleCard} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={26} color={color} />
      </View>
      <Text style={styles.moduleLabel}>{label}</Text>
      <Text style={styles.moduleDescription}>{description}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f7fb' },
  scrollContent: { padding: 20 },
  welcomeSection: { marginBottom: 20 },
  welcomeText: { fontSize: 24, fontWeight: '900', color: '#1e293b' },
  dateText: { fontSize: 14, color: '#64748b', marginTop: 4, textTransform: 'capitalize' },
  summaryCard: {
    backgroundColor: LOGO_BLUE,
    borderRadius: 24,
    padding: 25,
    marginBottom: 30,
    elevation: 8,
    shadowColor: LOGO_BLUE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, 
    shadowRadius: 12,
  },
  summaryInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  summaryValue: { color: '#fff', fontSize: 34, fontWeight: '900', marginTop: 5 },
  iconCircle: { backgroundColor: '#fff', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  summaryDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 15 },
  summaryFooter: { flexDirection: 'row', alignItems: 'center' },
  footerText: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', marginBottom: 15 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  moduleCard: {
    backgroundColor: '#fff',
    width: '48%',
    padding: 20,
    borderRadius: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 2,
  },
  iconContainer: { width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  moduleLabel: { fontSize: 16, fontWeight: '800', color: '#334155', marginBottom: 4 },
  moduleDescription: { fontSize: 12, color: '#94a3b8' },
  recentActivityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 },
  seeAllText: { color: LOGO_BLUE, fontSize: 14, fontWeight: '700' },
  emptyStateContainer: { 
    backgroundColor: '#fff', padding: 30, borderRadius: 20, alignItems: 'center', 
    justifyContent: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: '#e2e8f0'
  },
  emptyStateText: { color: '#94a3b8', fontSize: 14, marginTop: 10 },
  ventaItem: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', 
    padding: 15, borderRadius: 18, marginBottom: 10, elevation: 1 
  },
  ventaIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f0f7ff', justifyContent: 'center', alignItems: 'center' },
  ventaText: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  ventaHora: { fontSize: 12, color: '#94a3b8', marginTop: 2 }
});