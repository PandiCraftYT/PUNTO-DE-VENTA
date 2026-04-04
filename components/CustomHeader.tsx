import React, { useState, useRef } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, Modal, 
  Animated, Dimensions, TouchableWithoutFeedback, 
  ScrollView, Platform, Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../app/lib/auth_context'; // Ajustado con el guion bajo
import { supabase } from '../app/lib/supabase'; // Ajustado con el guion bajo

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(width * 0.75, 300);
const LOGO_BLUE = '#0056FF';

export default function CustomHeader({ title = "Punto de Venta" }: any) {
  const router = useRouter();
  const { usuario, setUsuario } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  
  // ESTADO NUEVO: Detecta si el enlace de la imagen está roto
  const [errorImagen, setErrorImagen] = useState(false);

  const esAdmin = usuario?.rol === 'admin';
  const nombreMostrar = usuario?.nombre || "Cargando...";
  const rolMostrar = usuario?.rol?.toUpperCase() || "EMPLEADO";
  const fotoPerfil = usuario?.avatar_url;

  const toggleSidebar = (open: boolean) => {
    if (open) {
      setIsSidebarOpen(true);
      Animated.timing(slideAnim, {
        toValue: 0, duration: 300, useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -SIDEBAR_WIDTH, duration: 250, useNativeDriver: true,
      }).start(() => setIsSidebarOpen(false));
    }
  };

  const navegar = (ruta: string) => {
    toggleSidebar(false);
    router.push(ruta as any);
  };

  const cerrarSesion = async () => {
    try {
      if (usuario?.id) {
        const fechaPasada = new Date();
        fechaPasada.setHours(fechaPasada.getHours() - 1);
        await supabase.from('usuarios').update({ ultima_conexion: fechaPasada.toISOString() }).eq('id', usuario.id);
      }
    } catch (err) {
      console.log("Error al desconectar:", err);
    } finally {
      toggleSidebar(false);
      setUsuario(null);
      if (Platform.OS === 'web') { window.location.href = '/login'; } else { router.replace('/login'); }
    }
  };

  return (
    <View style={styles.headerContainer}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.menuButton} onPress={() => toggleSidebar(true)}>
          <Ionicons name="menu-outline" size={30} color="#333" />
        </TouchableOpacity>
        <View style={styles.textContainer}>
          <Text style={styles.welcomeText}>{rolMostrar}</Text>
          <Text style={styles.brandName}>{title}</Text>
          <Text style={styles.dateText}>{nombreMostrar}</Text>
        </View>
      </View>

      <Modal visible={isSidebarOpen} transparent animationType="none">
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => toggleSidebar(false)}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>
          <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
            <View style={styles.sidebarInner}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
                
                <View style={styles.sidebarHeader}>
                  <View style={styles.avatarWrapper}>
                    {/* LÓGICA DE IMAGEN CORREGIDA CON ONERROR */}
                    {fotoPerfil && fotoPerfil.startsWith('http') && !errorImagen ? (
                      <Image 
                        source={{ uri: fotoPerfil }} 
                        style={styles.avatarImage} 
                        resizeMode="cover"
                        onError={() => setErrorImagen(true)} // Si el link está roto, cambia a true
                      />
                    ) : (
                      <Ionicons name="person-circle-outline" size={85} color={LOGO_BLUE} />
                    )}
                  </View>
                  <Text style={styles.sidebarUser} numberOfLines={2}>{nombreMostrar}</Text>
                  <Text style={[styles.sidebarRole, { color: esAdmin ? '#9c27b0' : LOGO_BLUE }]}>{rolMostrar}</Text>
                </View>

                <TouchableOpacity style={styles.menuItem} onPress={() => navegar('/(admin)/perfil')}>
                  <Ionicons name="person-outline" size={24} color="#333" />
                  <Text style={styles.menuText}>Mi Perfil</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => navegar('/(admin)/ventas')}>
                  <Ionicons name="cart-outline" size={24} color="#333" />
                  <Text style={styles.menuText}>Realizar Venta</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => navegar('/(admin)/taller')}>
                  <Ionicons name="hardware-chip-outline" size={24} color="#333" />
                  <Text style={styles.menuText}>Control de Taller</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => navegar('/(admin)/cotizacion')}>
                  <Ionicons name="calculator-outline" size={24} color="#333" />
                  <Text style={styles.menuText}>Cotización Rápida</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => navegar('/(admin)/servicios')}>
                  <Ionicons name="list-outline" size={24} color="#333" />
                  <Text style={styles.menuText}>Catálogo de Servicios</Text>
                </TouchableOpacity>

                {esAdmin && (
                  <View style={styles.adminSection}>
                    <Text style={styles.sectionTitle}>SISTEMA ADMIN</Text>
                    <TouchableOpacity style={styles.menuItem} onPress={() => navegar('/(admin)/inversion')}>
                      <Ionicons name="pie-chart-outline" size={24} color="#9c27b0" />
                      <Text style={[styles.menuText, { color: '#9c27b0' }]}>Capital e Inversión</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem} onPress={() => navegar('/(admin)/usuarios')}>
                      <Ionicons name="people-outline" size={24} color="#9c27b0" />
                      <Text style={[styles.menuText, { color: '#9c27b0' }]}>Gestionar Usuarios</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
              
              <View style={styles.footer}>
                <TouchableOpacity style={styles.logoutBtn} onPress={cerrarSesion}>
                  <Ionicons name="log-out-outline" size={24} color="#e74c3c" />
                  <Text style={styles.logoutText}>Cerrar Sesión</Text>
                </TouchableOpacity>
              </View>

            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', zIndex: 100 },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 45, paddingBottom: 15 },
  menuButton: { padding: 5, marginRight: 15, justifyContent: 'center', alignItems: 'center' },
  textContainer: { justifyContent: 'center' },
  welcomeText: { fontSize: 10, color: LOGO_BLUE, fontWeight: 'bold', letterSpacing: 0.5 },
  brandName: { fontSize: 18, fontWeight: '900', color: '#1e293b', letterSpacing: 0.5 },
  dateText: { fontSize: 12, color: '#64748b', marginTop: 2 },
  modalOverlay: { flex: 1, flexDirection: 'row' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sidebar: { width: SIDEBAR_WIDTH, height: '100%', backgroundColor: '#fff', position: 'absolute', left: 0, elevation: 15, shadowColor: '#000', shadowOffset: { width: 5, height: 0 }, shadowOpacity: 0.1, shadowRadius: 15 },
  sidebarInner: { flex: 1, paddingTop: Platform.OS === 'ios' ? 50 : 40 },
  scrollContainer: { paddingHorizontal: 25, paddingBottom: 20 },
  sidebarHeader: { alignItems: 'center', marginBottom: 30, paddingBottom: 25, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  avatarWrapper: { width: 85, height: 85, borderRadius: 42.5, justifyContent: 'center', alignItems: 'center', marginBottom: 10, overflow: 'hidden' },
  avatarImage: { width: 85, height: 85, borderRadius: 42.5 },
  sidebarUser: { fontSize: 18, fontWeight: '800', color: '#1e293b', textAlign: 'center', paddingHorizontal: 5 },
  sidebarRole: { fontSize: 12, fontWeight: 'bold', marginTop: 5, letterSpacing: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, marginBottom: 5 },
  menuText: { fontSize: 16, marginLeft: 15, color: '#475569', fontWeight: '600' },
  adminSection: { marginTop: 25, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  sectionTitle: { fontSize: 11, color: '#94a3b8', fontWeight: 'bold', marginBottom: 15, letterSpacing: 1 },
  footer: { padding: 25, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fff', paddingBottom: Platform.OS === 'ios' ? 40 : 25 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center' },
  logoutText: { color: '#e74c3c', fontSize: 16, fontWeight: 'bold', marginLeft: 15 }
});