import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, TextInput, ActivityIndicator, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const LOGO_BLUE = '#0056FF';

const getColorEstado = (estado: string) => {
  if (estado === 'RECIBIDO') return '#e74c3c';
  if (estado === 'EN REVISIÓN') return '#f39c12';
  if (estado === 'LISTO') return '#2ecc71';
  if (estado === 'ENTREGADO') return '#94a3b8';
  return '#95a5a6';
};

const formatearFecha = (fechaString: string) => {
  if (!fechaString) return 'Fecha desconocida';
  const opciones: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return new Date(fechaString).toLocaleDateString('es-MX', opciones);
};

export const ModalFormularioCliente = ({
  visible, setVisible, nombre, setNombre, telefono, setTelefono, notas, setNotas, guardarCliente, guardando, clienteEditando
}: any) => (
  <Modal visible={visible} animationType="slide" transparent={true}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>{clienteEditando ? 'Editar Cliente' : 'Nuevo Cliente'}</Text>
        <TextInput style={styles.input} placeholder="Nombre Completo" placeholderTextColor="#a0aec0" value={nombre} onChangeText={setNombre} />
        <TextInput style={styles.input} placeholder="WhatsApp (10 dígitos)" placeholderTextColor="#a0aec0" keyboardType="phone-pad" value={telefono} onChangeText={setTelefono} />
        <TextInput 
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
          placeholder="Notas o Preferencias" 
          placeholderTextColor="#a0aec0"
          multiline value={notas} 
          onChangeText={setNotas} 
        />
        <View style={styles.modalButtons}>
          <TouchableOpacity style={[styles.btn, {backgroundColor: '#f1f5f9'}]} onPress={() => setVisible(false)}>
            <Text style={{color: '#64748b', fontWeight: 'bold'}}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, {backgroundColor: LOGO_BLUE}]} onPress={guardarCliente} disabled={guardando}>
            <Text style={{color: '#fff', fontWeight: 'bold'}}>{guardando ? 'Guardando...' : (clienteEditando ? 'Actualizar' : 'Registrar')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

export const ModalPerfilVIP = ({
  visible, setVisible, clienteActivo, historialEquipos, cargandoHistorial, abrirEditarCliente, confirmarEliminacion
}: any) => (
  <Modal visible={visible} animationType="slide" transparent={true}>
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContent, { height: '85%', padding: 0, overflow: 'hidden' }]}>
        <View style={styles.perfilHeader}>
          <TouchableOpacity onPress={() => setVisible(false)} style={styles.closePerfilBtn}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.perfilAvatarLarge}>
            <Text style={styles.perfilAvatarLargeText}>{clienteActivo?.nombre?.substring(0, 2).toUpperCase()}</Text>
          </View>
          <Text style={styles.perfilNombreLargo}>{clienteActivo?.nombre}</Text>
          <Text style={styles.perfilTelefonoLargo}>{clienteActivo?.telefono}</Text>

          <View style={styles.perfilCajasHeader}>
            <View style={styles.cajaDato}>
              <Text style={styles.cajaDatoValor}>${clienteActivo?.total_gastado?.toFixed(2) || '0.00'}</Text>
              <Text style={styles.cajaDatoEtiqueta}>Inversión Total</Text>
            </View>
            <View style={styles.lineaVertical} />
            <View style={styles.cajaDato}>
              <Text style={styles.cajaDatoValor}>{historialEquipos.length}</Text>
              <Text style={styles.cajaDatoEtiqueta}>Equipos en Taller</Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.perfilBody} showsVerticalScrollIndicator={false}>
          {/* BOTONES DE EDICIÓN Y ELIMINACIÓN */}
          <View style={styles.accionesRow}>
            <TouchableOpacity style={[styles.btnAccion, { backgroundColor: '#e0e7ff' }]} onPress={() => abrirEditarCliente(clienteActivo)}>
              <Ionicons name="pencil" size={16} color={LOGO_BLUE} />
              <Text style={[styles.btnAccionTexto, { color: LOGO_BLUE }]}>Editar Datos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnAccion, { backgroundColor: '#fee2e2' }]} onPress={() => confirmarEliminacion(clienteActivo)}>
              <Ionicons name="trash" size={16} color="#e74c3c" />
              <Text style={[styles.btnAccionTexto, { color: '#e74c3c' }]}>Eliminar</Text>
            </TouchableOpacity>
          </View>

          {clienteActivo?.notas ? (
            <View style={styles.notaGris}>
              <Ionicons name="information-circle" size={20} color={LOGO_BLUE} />
              <Text style={styles.notaTexto}>{clienteActivo.notas}</Text>
            </View>
          ) : null}

          <Text style={styles.historialTitulo}>Historial de Reparaciones</Text>

          {cargandoHistorial ? (
            <ActivityIndicator size="small" color={LOGO_BLUE} style={{ marginTop: 20 }} />
          ) : historialEquipos.length > 0 ? (
            historialEquipos.map((equipo: any) => (
              <View key={equipo.id} style={styles.historialItem}>
                <View style={styles.historialTop}>
                  <Text style={styles.historialEquipoTexto}>{equipo.equipo}</Text>
                  <View style={[styles.badge, { backgroundColor: getColorEstado(equipo.estado) }]}>
                    <Text style={styles.badgeText}>{equipo.estado}</Text>
                  </View>
                </View>
                <Text style={styles.historialProblemaTexto}>{equipo.problema}</Text>
                <View style={styles.historialBottom}>
                  <Text style={styles.historialFechaTexto}><Ionicons name="calendar-outline" size={12}/> {formatearFecha(equipo.created_at)}</Text>
                  <Text style={styles.historialCostoTexto}>${equipo.costo_estimado}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyHistorial}>
              <Ionicons name="construct-outline" size={40} color="#cbd5e1" />
              <Text style={styles.emptyHistorialText}>Este cliente no ha dejado equipos en taller.</Text>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </View>
  </Modal>
);

export const ModalCampana = ({
  visible, setVisible, equipoCampana, setEquipoCampana, mensajeCampana, setMensajeCampana,
  buscarParaCampana, buscandoCampana, clientesCampana, abrirWhatsApp
}: any) => (
  <Modal visible={visible} animationType="slide" transparent={true}>
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContent, { height: '80%', padding: 0, overflow: 'hidden' }]}>
        <View style={styles.campanaHeader}>
          <Text style={styles.campanaTitulo}><Ionicons name="megaphone" size={20}/> Promociones</Text>
          <TouchableOpacity onPress={() => setVisible(false)}>
            <Ionicons name="close" size={28} color="#1e293b" />
          </TouchableOpacity>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={styles.campanaInstruccion}>1. ¿A quiénes quieres enviarles promoción?</Text>
          <View style={{ flexDirection: 'row', marginBottom: 15 }}>
            <TextInput 
              style={[styles.input, { flex: 1, marginBottom: 0 }]} 
              placeholder="Ej. PS5, Switch..." 
              placeholderTextColor="#a0aec0"
              value={equipoCampana} 
              onChangeText={setEquipoCampana} 
            />
            <TouchableOpacity style={styles.btnBuscarCampana} onPress={buscarParaCampana}>
              <Ionicons name="search" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.campanaInstruccion}>2. Redacta tu mensaje</Text>
          <TextInput 
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
            placeholder="Escribe tu mensaje publicitario..." 
            multiline 
            value={mensajeCampana} 
            onChangeText={setMensajeCampana} 
          />
        </View>

        <View style={styles.campanaResultadosHeader}>
          <Text style={{ fontWeight: 'bold', color: '#64748b' }}>Clientes Encontrados: {clientesCampana.length}</Text>
        </View>

        <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          {buscandoCampana ? (
            <ActivityIndicator color={LOGO_BLUE} style={{ marginTop: 20 }} />
          ) : clientesCampana.length > 0 ? (
            clientesCampana.map((cli: any, index: number) => (
              <View key={index} style={styles.campanaItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.campanaNombre}>{cli.cliente}</Text>
                  <Text style={styles.campanaEquipo}>Equipo en historial: {cli.equipo}</Text>
                </View>
                <TouchableOpacity style={styles.btnEnviarPromo} onPress={() => abrirWhatsApp(cli.telefono, mensajeCampana)}>
                  <Ionicons name="send" size={14} color="#fff" style={{ marginRight: 5 }} />
                  <Text style={styles.btnEnviarPromoText}>Enviar</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.emptyHistorial}>
              <Ionicons name="chatbubbles-outline" size={40} color="#cbd5e1" />
              <Text style={styles.emptyHistorialText}>Busca un equipo para ver la lista de envío.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', padding: 25, borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1e293b', marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, marginBottom: 15, fontSize: 15 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  btn: { flex: 1, padding: 15, borderRadius: 15, alignItems: 'center', marginHorizontal: 5 },
  perfilHeader: { backgroundColor: LOGO_BLUE, paddingTop: 40, paddingBottom: 25, alignItems: 'center', position: 'relative' },
  closePerfilBtn: { position: 'absolute', top: 15, right: 15, padding: 5 },
  perfilAvatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 15, elevation: 5 },
  perfilAvatarLargeText: { fontSize: 30, fontWeight: '900', color: LOGO_BLUE },
  perfilNombreLargo: { fontSize: 22, fontWeight: '900', color: '#fff' },
  perfilTelefonoLargo: { fontSize: 15, color: 'rgba(255,255,255,0.8)', marginTop: 5 },
  perfilCajasHeader: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 15, padding: 15, marginTop: 20, width: '85%', justifyContent: 'space-evenly' },
  cajaDato: { alignItems: 'center' },
  cajaDatoValor: { fontSize: 18, fontWeight: '900', color: '#fff' },
  cajaDatoEtiqueta: { fontSize: 11, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginTop: 4 },
  lineaVertical: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', height: '100%' },
  perfilBody: { padding: 25, backgroundColor: '#f6f7fb', flex: 1 },
  accionesRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  btnAccion: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, marginHorizontal: 5 },
  btnAccionTexto: { fontWeight: 'bold', marginLeft: 8, fontSize: 13 },
  notaGris: { flexDirection: 'row', backgroundColor: '#e0e7ff', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 25 },
  notaTexto: { color: '#334155', marginLeft: 10, flex: 1, fontStyle: 'italic' },
  historialTitulo: { fontSize: 16, fontWeight: '900', color: '#1e293b', marginBottom: 15 },
  historialItem: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9' },
  historialTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historialEquipoTexto: { fontSize: 16, fontWeight: 'bold', color: '#334155' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  historialProblemaTexto: { fontSize: 13, color: '#64748b', marginTop: 5, marginBottom: 10 },
  historialBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  historialFechaTexto: { fontSize: 12, color: '#94a3b8' },
  historialCostoTexto: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  emptyHistorial: { alignItems: 'center', marginTop: 30, padding: 20 },
  emptyHistorialText: { color: '#94a3b8', marginTop: 10, fontSize: 14, textAlign: 'center' },
  campanaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  campanaTitulo: { fontSize: 18, fontWeight: '900', color: '#1e293b' },
  campanaInstruccion: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 8 },
  btnBuscarCampana: { backgroundColor: LOGO_BLUE, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center', borderTopRightRadius: 12, borderBottomRightRadius: 12, marginLeft: -10 },
  campanaResultadosHeader: { backgroundColor: '#f1f5f9', padding: 10, paddingHorizontal: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  campanaItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
  campanaNombre: { fontWeight: 'bold', color: '#334155', fontSize: 15 },
  campanaEquipo: { color: '#64748b', fontSize: 12, marginTop: 2 },
  btnEnviarPromo: { flexDirection: 'row', backgroundColor: '#25D366', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  btnEnviarPromoText: { color: '#fff', fontWeight: 'bold', fontSize: 12 }
});