import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView, 
  ScrollView, ActivityIndicator, RefreshControl, Modal, Platform 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

import CustomHeader from '../../components/CustomHeader';
import FooterNav from '../../components/FooterNav';
import { useAuth } from '../lib/auth_context'; 
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
const LOGO_BLUE = '#0056FF';

interface ModuleButtonProps {
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
}

// LISTA DE TODOS LOS MÓDULOS DISPONIBLES EN TU SISTEMA
const MODULOS_DISPONIBLES = [
  { id: 'ventas', label: 'Nueva Venta', desc: 'Punto de venta', icon: 'cart', color: '#0056FF', route: '/(admin)/ventas' },
  { id: 'nuevo_gasto', label: 'Nuevo Gasto', desc: 'Salidas de dinero', icon: 'wallet', color: '#e74c3c', route: '/(admin)/nuevo_gasto' },
  { id: 'productos', label: 'Productos', desc: 'Tu inventario', icon: 'cube', color: '#2ecc71', route: '/(admin)/productos' },
  { id: 'cotizacion', label: 'Cotizaciones', desc: 'Presupuestos PDF', icon: 'document-text', color: '#34495e', route: '/(admin)/cotizacion' },
  { id: 'reportes', label: 'Reportes', desc: 'Cortes de caja', icon: 'bar-chart', color: '#e67e22', route: '/(admin)/historial' },
  { id: 'taller', label: 'Taller', desc: 'Control de equipos', icon: 'build', color: '#e74c3c', route: '/(admin)/taller' },
  { id: 'inversion', label: 'Inversión', desc: 'Gastos y compras', icon: 'cash', color: '#9b59b6', route: '/(admin)/inversion' },
  { id: 'usuarios', label: 'Usuarios', desc: 'Gestión de personal', icon: 'people', color: '#16a085', route: '/(admin)/usuarios' },
  { id: 'servicios', label: 'Servicios', desc: 'Catálogo de reparaciones', icon: 'construct', color: '#f39c12', route: '/(admin)/servicios' },
  { id: 'clientes', label: 'Clientes', desc: 'Directorio y lealtad', icon: 'people', color: '#3b82f6', route: '/(admin)/clientes' },
];

export default function AdminDashboard() {
  const router = useRouter();
  
  // AÑADIDO: Extraemos cargandoSesion del contexto
  const { usuario, cargandoSesion } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ventasHoy, setVentasHoy] = useState<any[]>([]);
  const [totalDinero, setTotalDinero] = useState(0);
  const [equiposTaller, setEquiposTaller] = useState(0);

  // Estados para la personalización de módulos
  const [modalModulosVisible, setModalModulosVisible] = useState(false);
  // Módulos por defecto si es la primera vez que entran
  const [modulosActivos, setModulosActivos] = useState<string[]>(['ventas', 'productos', 'reportes', 'inversion']);

  // --- SISTEMA DE NOTIFICACIONES PUSH (AÑADIDO AQUÍ) ---
  useEffect(() => {
    if (usuario) {
      registrarSuscripcionPush();
    }
  }, [usuario]);

  const registrarSuscripcionPush = async () => {
    // 1. Verificamos que sea un celular físico
    if (Platform.OS === 'web') return; 
    
    if (Device.isDevice) {
      // 2. Pedimos permiso al usuario
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('No se dio permiso para notificaciones');
        return;
      }

      // 3. Obtenemos el Token único del celular
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig?.extra?.eas?.projectId,
        });
        const pushToken = tokenData.data;
        console.log("MI PUSH TOKEN ES:", pushToken);

        // 4. Lo guardamos en Supabase en el perfil de este usuario
        const { error } = await supabase
          .from('usuarios')
          .update({ push_token: pushToken })
          .eq('id', usuario.id);

        if (error) console.error("Error guardando token:", error);

      } catch (error) {
        console.log("Error obteniendo token:", error);
      }
    } else {
      console.log('Las notificaciones Push necesitan un dispositivo físico.');
    }
  };
  // --------------------------------------------------------

  useEffect(() => {
    // Cargar preferencias de módulos si estamos en la web
    if (Platform.OS === 'web') {
      const guardados = localStorage.getItem('gs_modulos_preferidos');
      if (guardados) {
        setModulosActivos(JSON.parse(guardados));
      }
    }

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

      // 1. Cargar Ventas
      const { data: ventasData, error: ventasError } = await supabase
        .from('ventas')
        .select('*')
        .gte('created_at', hoy.toISOString())
        .order('created_at', { ascending: false });

      if (ventasError) throw ventasError;

      if (ventasData) {
        setVentasHoy(ventasData);
        const suma = ventasData.reduce((acc, v) => acc + parseFloat(v.total), 0);
        setTotalDinero(suma);
      }

      // 2. Cargar Equipos Pendientes dependiendo del ROL
      let estadosFiltro = [];
      if (usuario?.rol === 'admin') {
        // Al admin le importan los que tiene que reparar
        estadosFiltro = ['RECIBIDO', 'EN REVISIÓN', 'EN REVISION'];
      } else {
        // Al empleado le importan los que ya puede entregar/cobrar
        estadosFiltro = ['LISTO'];
      }

      const { count, error: tallerError } = await supabase
        .from('reparaciones')
        .select('*', { count: 'exact', head: true })
        .in('estado', estadosFiltro); 

      if (!tallerError && count !== null) {
        setEquiposTaller(count);
      }

    } catch (err) {
      console.log("Error dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cargarDatosDashboard();
    setRefreshing(false);
  }, []);

  const obtenerSaludo = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Buenos días';
    if (hora < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const fechaTexto = new Date().toLocaleDateString('es-MX', { 
    weekday: 'long', day: 'numeric', month: 'long' 
  });

  const toggleModulo = (id: string) => {
    if (modulosActivos.includes(id)) {
      if (modulosActivos.length <= 1) return; 
      setModulosActivos(prev => prev.filter(m => m !== id));
    } else {
      setModulosActivos(prev => [...prev, id]);
    }
  };

  const guardarPersonalizacion = () => {
    if (Platform.OS === 'web') {
      localStorage.setItem('gs_modulos_preferidos', JSON.stringify(modulosActivos));
    }
    setModalModulosVisible(false);
  };

  // AÑADIDO: Mostrar pantalla de carga general si la sesión aún se está verificando
  if (cargandoSesion) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={LOGO_BLUE} />
      </View>
    );
  }

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

        {equiposTaller > 0 && (
          <TouchableOpacity 
            style={styles.tallerIndicator}
            onPress={() => router.push('/(admin)/taller' as any)}
            activeOpacity={0.8}
          >
            <View style={styles.tallerIndicatorLeft}>
              <View style={[styles.tallerIconBadge, usuario?.rol !== 'admin' && { backgroundColor: '#dcfce7' }]}>
                <Ionicons 
                  name={usuario?.rol === 'admin' ? "build" : "checkmark-done"} 
                  size={20} 
                  color={usuario?.rol === 'admin' ? "#e67e22" : "#22c55e"} 
                />
              </View>
              <Text style={styles.tallerIndicatorText}>
                {usuario?.rol === 'admin' ? 'Equipos en Taller' : 'Equipos Listos'}
              </Text>
            </View>
            <View style={[styles.tallerBadge, usuario?.rol !== 'admin' && { backgroundColor: '#22c55e' }]}>
              <Text style={styles.tallerBadgeText}>{equiposTaller}</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Módulos de Gestión</Text>
          <TouchableOpacity onPress={() => setModalModulosVisible(true)}>
            <Text style={styles.editModulesText}>Personalizar</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.gridContainer}>
          {MODULOS_DISPONIBLES
            .filter(mod => modulosActivos.includes(mod.id))
            .map(mod => (
              <ModuleButton 
                key={mod.id}
                label={mod.label} 
                description={mod.desc}
                icon={mod.icon as any} 
                color={mod.color} 
                onPress={() => router.push(mod.route as any)} 
              />
          ))}
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

      <Modal visible={modalModulosVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configurar Accesos</Text>
            <Text style={styles.modalSubtitle}>Selecciona los módulos que deseas ver en tu pantalla de inicio.</Text>
            
            <ScrollView style={{ maxHeight: 300, marginBottom: 15 }}>
              {MODULOS_DISPONIBLES.map(mod => {
                const isActive = modulosActivos.includes(mod.id);
                return (
                  <TouchableOpacity 
                    key={mod.id} 
                    style={[styles.moduloOption, isActive && styles.moduloOptionActive]}
                    onPress={() => toggleModulo(mod.id)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.miniIconContainer, { backgroundColor: mod.color + '20' }]}>
                        <Ionicons name={mod.icon as any} size={18} color={mod.color} />
                      </View>
                      <Text style={[styles.moduloOptionText, isActive && { fontWeight: 'bold' }]}>{mod.label}</Text>
                    </View>
                    <Ionicons 
                      name={isActive ? "checkmark-circle" : "ellipse-outline"} 
                      size={24} 
                      color={isActive ? LOGO_BLUE : '#cbd5e1'} 
                    />
                  </TouchableOpacity>
                )
              })}
            </ScrollView>

            <TouchableOpacity style={styles.btnGuardarPersonalizacion} onPress={guardarPersonalizacion}>
              <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 16}}>Guardar Preferencias</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
    marginBottom: 20,
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
  
  tallerIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tallerIndicatorLeft: { flexDirection: 'row', alignItems: 'center' },
  tallerIconBadge: {
    backgroundColor: '#fff7ed', 
    width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  tallerIndicatorText: { fontSize: 16, fontWeight: '800', color: '#334155' },
  tallerBadge: { backgroundColor: '#e74c3c', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  tallerBadgeText: { color: '#fff', fontWeight: '900', fontSize: 14 },

  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  editModulesText: { fontSize: 14, fontWeight: '700', color: LOGO_BLUE },

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
  
  recentActivityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 15 },
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
  ventaHora: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', padding: 25, borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingBottom: Platform.OS === 'ios' ? 40 : 25 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1e293b', marginBottom: 5 },
  modalSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 20 },
  moduloOption: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingVertical: 12, paddingHorizontal: 15, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#f1f5f9'
  },
  moduloOptionActive: { backgroundColor: '#f0f5ff', borderColor: '#dbeafe' },
  miniIconContainer: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  moduloOptionText: { fontSize: 15, color: '#334155' },
  btnGuardarPersonalizacion: { backgroundColor: LOGO_BLUE, paddingVertical: 15, borderRadius: 15, alignItems: 'center', marginTop: 10 },
});