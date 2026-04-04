// components/ModalesTaller.tsx
import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, TextInput, Linking, Platform, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const LOGO_BLUE = '#0056FF';

// Esta función nos ayuda a formatear la fecha
const formatearFecha = (fechaString: string) => {
  if (!fechaString) return 'Fecha desconocida';
  const opciones: Intl.DateTimeFormatOptions = { 
    year: 'numeric', month: 'long', day: 'numeric', 
    hour: '2-digit', minute: '2-digit' 
  };
  return new Date(fechaString).toLocaleDateString('es-MX', opciones);
};

export const ModalAgregarEquipo = ({
  visible, setVisible, cliente, handleCambioCliente, telefono, setTelefono, equipo, setEquipo,
  problema, setProblema, costo, setCosto, sucursal, setSucursal, guardarReparacion, guardando,
  mostrarSugerencias, sugerencias, seleccionarCliente, setMostrarSugerencias
}: any) => (
  <Modal visible={visible} animationType="slide" transparent={true}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Recibir Equipo</Text>
        
        <View style={{ zIndex: 10 }}>
          <TextInput 
            style={styles.input} 
            placeholder="Nombre del Cliente" 
            placeholderTextColor="#a0aec0"
            value={cliente} 
            onChangeText={handleCambioCliente} 
          />
          {mostrarSugerencias && sugerencias.length > 0 && (
            <View style={styles.sugerenciasContainer}>
              {sugerencias.map((sug: any) => (
                <TouchableOpacity key={sug.id} style={styles.sugerenciaItem} onPress={() => seleccionarCliente(sug)}>
                  <Ionicons name="person" size={14} color="#94a3b8" style={{ marginRight: 8 }} />
                  <View>
                    <Text style={{ fontWeight: 'bold', color: '#334155' }}>{sug.nombre}</Text>
                    <Text style={{ fontSize: 11, color: '#94a3b8' }}>{sug.telefono}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TextInput style={styles.input} placeholder="Teléfono (WhatsApp)" placeholderTextColor="#a0aec0" keyboardType="phone-pad" value={telefono} onChangeText={setTelefono} />
        <TextInput style={styles.input} placeholder="Equipo (Ej. PS5, Switch)" placeholderTextColor="#a0aec0" value={equipo} onChangeText={setEquipo} />
        <TextInput style={styles.input} placeholder="Falla o Problema" placeholderTextColor="#a0aec0" value={problema} onChangeText={setProblema} />
        <TextInput style={styles.input} placeholder="Costo Estimado ($)" placeholderTextColor="#a0aec0" keyboardType="numeric" value={costo} onChangeText={setCosto} />
        
        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 5, marginBottom: 5, marginLeft: 5, fontWeight: 'bold' }}>UBICACIÓN DE RECEPCIÓN</Text>
        <View style={{ flexDirection: 'row', marginBottom: 15 }}>
          <TouchableOpacity style={[styles.btnSucursal, sucursal === 'Centro' && styles.btnSucursalActivo]} onPress={() => setSucursal('Centro')}>
            <Text style={[styles.textSucursal, sucursal === 'Centro' && { color: '#fff' }]}>Centro</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnSucursal, sucursal === 'Huizaches' && styles.btnSucursalActivo]} onPress={() => setSucursal('Huizaches')}>
            <Text style={[styles.textSucursal, sucursal === 'Huizaches' && { color: '#fff' }]}>Huizaches</Text>
          </TouchableOpacity>
        </View>

        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 10}}>
          <TouchableOpacity style={[styles.btn, {backgroundColor: '#ccc'}]} onPress={() => {setVisible(false); setMostrarSugerencias(false);}}>
            <Text style={{fontWeight: 'bold'}}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, {backgroundColor: LOGO_BLUE}]} onPress={guardarReparacion} disabled={guardando}>
            <Text style={{color: '#fff', fontWeight: 'bold'}}>{guardando ? 'Guardando...' : 'Guardar Ingreso'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

export const ModalCambiarEstado = ({ visible, setVisible, reparacionActiva, actualizarEstadoBD }: any) => (
  <Modal visible={visible} animationType="fade" transparent={true}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContentSmall}>
        <Text style={styles.modalTitle}>Actualizar Proceso</Text>
        <Text style={{textAlign: 'center', marginBottom: 15, color: '#64748b'}}>
          ¿En qué estado se encuentra el equipo {reparacionActiva?.equipo}?
        </Text>
        <TouchableOpacity style={[styles.btnEstado, {backgroundColor: '#e74c3c'}]} onPress={() => actualizarEstadoBD('RECIBIDO')}><Text style={styles.btnEstadoText}>Recién Recibido</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btnEstado, {backgroundColor: '#f39c12'}]} onPress={() => actualizarEstadoBD('EN REVISIÓN')}><Text style={styles.btnEstadoText}>En Revisión / Reparando</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btnEstado, {backgroundColor: '#2ecc71'}]} onPress={() => actualizarEstadoBD('LISTO')}><Text style={styles.btnEstadoText}>Listo para Entregar</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btnEstado, {backgroundColor: '#94a3b8'}]} onPress={() => actualizarEstadoBD('ENTREGADO')}><Text style={styles.btnEstadoText}>Marcar como Entregado</Text></TouchableOpacity>
        <TouchableOpacity style={{marginTop: 15, padding: 10, alignItems: 'center'}} onPress={() => setVisible(false)}>
          <Text style={{color: '#94a3b8', fontWeight: 'bold'}}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

export const ModalDetalles = ({ visible, setVisible, reparacionActiva, confirmarEliminacion }: any) => (
  <Modal visible={visible} animationType="slide" transparent={true}>
    <View style={styles.modalOverlay}>
      {/* AQUÍ ESTÁ EL CAMBIO: Agregamos alignSelf: 'center' */}
      <View style={[styles.modalContent, { maxHeight: '85%', width: '90%', alignSelf: 'center' }]}>
        
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <Text style={styles.modalTitle}>Detalles de Solicitud</Text>
          <TouchableOpacity onPress={() => setVisible(false)}><Ionicons name="close" size={24} color="#64748b" /></TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {reparacionActiva && (
            <View style={{ paddingBottom: 10 }}>
              <View style={styles.detalleFila}><Ionicons name="hardware-chip" size={18} color="#64748b" style={styles.detalleIcono} /><View><Text style={styles.detalleLabel}>Equipo</Text><Text style={styles.detalleTexto}>{reparacionActiva.equipo}</Text></View></View>
              <View style={styles.detalleFila}><Ionicons name="person" size={18} color="#64748b" style={styles.detalleIcono} /><View><Text style={styles.detalleLabel}>Cliente</Text><Text style={styles.detalleTexto}>{reparacionActiva.cliente} ({reparacionActiva.telefono || 'Sin número'})</Text></View></View>
              <View style={styles.detalleFila}><Ionicons name="alert-circle" size={18} color="#64748b" style={styles.detalleIcono} /><View><Text style={styles.detalleLabel}>Problema Reportado</Text><Text style={styles.detalleTexto}>{reparacionActiva.problema}</Text></View></View>
              <View style={styles.detalleDivider} />
              <View style={styles.detalleFila}><Ionicons name="time" size={18} color={LOGO_BLUE} style={styles.detalleIcono} /><View><Text style={styles.detalleLabel}>Fecha y Hora de Ingreso</Text><Text style={styles.detalleTextoHighlight}>{formatearFecha(reparacionActiva.created_at)}</Text></View></View>
              <View style={styles.detalleFila}><Ionicons name="id-card" size={18} color={LOGO_BLUE} style={styles.detalleIcono} /><View><Text style={styles.detalleLabel}>Registrado y Atendido por</Text><Text style={styles.detalleTextoHighlight}>{reparacionActiva.registrado_por || 'Administrador'}</Text></View></View>
              <View style={[styles.detalleFila, { alignItems: 'flex-start' }]}>
                <Ionicons name="location" size={18} color={LOGO_BLUE} style={[styles.detalleIcono, { marginTop: 2 }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.detalleLabel}>Ubicación de Solicitud</Text>
                  <Text style={styles.detalleTextoHighlight}>{reparacionActiva.sucursal || 'Centro'}</Text>
                  <TouchableOpacity style={styles.mapContainer} activeOpacity={0.8} onPress={() => Linking.openURL(reparacionActiva.sucursal === 'Huizaches' ? 'https://www.google.com/maps/search/?api=1&query=Culiacan+Sinaloa' : 'https://maps.app.goo.gl/TU_ENLACE_DE_GOOGLE_MAPS')}>
                    <Image source={{ uri: 'https://media.wired.com/photos/59269cd37034dc5f91bec0f1/master/pass/GoogleMapTA.jpg' }} style={styles.mapImage} />
                    <View style={styles.mapOverlay}><View style={styles.mapButton}><Ionicons name="navigate-circle" size={20} color="#fff" /><Text style={styles.mapButtonText}>Ver Ubicación</Text></View></View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
        {reparacionActiva && (
          <TouchableOpacity style={{ marginTop: 15, paddingVertical: 10, alignItems: 'center' }} onPress={() => confirmarEliminacion(reparacionActiva.id, reparacionActiva.equipo)}>
            <Text style={{ color: '#e74c3c', fontWeight: 'bold', fontSize: 14 }}>Eliminar registro por error</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 15 },
  modalContentSmall: { backgroundColor: '#fff', padding: 25, borderRadius: 15 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  input: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, marginBottom: 10 },
  btn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 8, marginHorizontal: 5 },
  btnEstado: { padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  btnEstadoText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  sugerenciasContainer: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderTopWidth: 0, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, marginTop: -10, marginBottom: 10, maxHeight: 120, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, zIndex: 100 },
  sugerenciaItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  btnSucursal: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#f1f5f9', marginHorizontal: 5, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  btnSucursalActivo: { backgroundColor: LOGO_BLUE, borderColor: LOGO_BLUE },
  textSucursal: { fontWeight: 'bold', color: '#64748b' },
  detalleFila: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  detalleIcono: { marginRight: 15, width: 20, textAlign: 'center' },
  detalleLabel: { fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' },
  detalleTexto: { fontSize: 15, color: '#334155', marginTop: 2 },
  detalleTextoHighlight: { fontSize: 15, color: '#1e293b', marginTop: 2, fontWeight: '600' },
  detalleDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 10, marginBottom: 20 },
  mapContainer: { marginTop: 15, height: 150, width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#e2e8f0', position: 'relative', borderWidth: 1, borderColor: '#cbd5e1' },
  mapImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  mapOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.2)', justifyContent: 'center', alignItems: 'center' },
  mapButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: LOGO_BLUE, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
  mapButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 13, marginLeft: 6 }
});