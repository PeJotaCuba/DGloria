import React, { useState, useMemo } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { WebAuthUser } from '../hooks/useWebAuth';
import { getReservationStatusMeta } from '../utils/reservations';
import {
  X,
  LogOut,
  Search,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck2,
  Trash2,
  UserCheck,
  PlusCircle,
  LayoutGrid,
  Phone,
  MapPin,
  Loader2,
  Sparkles,
  RefreshCw,
  Ban,
  ChevronRight,
} from 'lucide-react';

interface WebReservationManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionToken: string;
  dvcCode: string;
  user: WebAuthUser;
  onLogout: () => Promise<void>;
}

type MainSection = 'gestion' | 'solicitud';
type ManagementTab =
  | 'Pendientes'
  | 'Confirmadas'
  | 'En negociación'
  | 'Canceladas'
  | 'Marcadas'
  | 'Consolidadas';

export const WebReservationManagementModal: React.FC<WebReservationManagementModalProps> = ({
  isOpen,
  onClose,
  sessionToken,
  dvcCode,
  user,
  onLogout,
}) => {
  const [mainSection, setMainSection] = useState<MainSection>('gestion');
  const [activeTab, setActiveTab] = useState<ManagementTab>('Pendientes');
  const [showCustomers, setShowCustomers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');

  // Action sub-panels state
  const [actionMode, setActionMode] = useState<
    null | 'assign_table' | 'negotiate' | 'reject' | 'cancel' | 'delete'
  >(null);
  const [forceOverrideSchedule, setForceOverrideSchedule] = useState(false);
  const [altDate, setAltDate] = useState('');
  const [altTime, setAltTime] = useState('');
  const [altNotes, setAltNotes] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Staff Solicitud form state
  const [staffForm, setStaffForm] = useState({
    fullName: '',
    emailOrPhone: '',
    date: new Date().toISOString().split('T')[0],
    time: '8:00 PM',
    partySize: 2,
    seatingArea: 'terraza',
    source: 'telefono',
    specialNotes: '',
  });
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const [staffFeedback, setStaffFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Convex queries
  const reservations = useQuery(
    api.reservations.webListReservations,
    isOpen ? { sessionToken, dvcCode } : 'skip'
  );
  const stats = useQuery(
    api.reservations.webGetBarTerrazaStats,
    isOpen ? { sessionToken, dvcCode } : 'skip'
  );
  const customers = useQuery(
    api.reservations.webListCustomers,
    isOpen && showCustomers
      ? { sessionToken, dvcCode, searchQuery: customerSearch || undefined }
      : 'skip'
  );
  const customerDetails = useQuery(
    api.reservations.webGetCustomerDetails,
    isOpen && showCustomers && selectedCustomerId
      ? { sessionToken, dvcCode, customerId: selectedCustomerId }
      : 'skip'
  );

  const selectedReservation = useMemo(() => {
    if (!reservations || !selectedReservationId) return null;
    return (
      reservations.find(
        (r) => r.id === selectedReservationId || r._id === selectedReservationId
      ) || null
    );
  }, [reservations, selectedReservationId]);

  const tableAvailability = useQuery(
    api.reservations.webCheckTableAvailability,
    isOpen && actionMode === 'assign_table' && selectedReservation
      ? {
          sessionToken,
          dvcCode,
          reservationId: selectedReservation.id,
        }
      : 'skip'
  );

  const alternativeSlots = useQuery(
    api.reservations.webFindAlternativeSlots,
    isOpen && actionMode === 'negotiate' && selectedReservation
      ? {
          sessionToken,
          dvcCode,
          reservationId: selectedReservation.id,
        }
      : 'skip'
  );

  // Convex mutations
  const assignTableAndConfirm = useMutation(
    api.reservations.webAssignTableAndConfirmReservation
  );
  const updateStatus = useMutation(api.reservations.webUpdateReservationStatus);
  const acceptAlternative = useMutation(api.reservations.webAcceptProposedAlternative);
  const consolidateRes = useMutation(api.reservations.webConsolidateReservation);
  const markNoShow = useMutation(api.reservations.webMarkReservationAsNoShow);
  const deleteRes = useMutation(api.reservations.webDeleteReservation);
  const createStaffRes = useMutation(api.reservations.webCreateStaffReservation);

  const filteredReservations = useMemo(() => {
    if (!reservations) return [];
    return reservations.filter((r) => {
      // Tab filter
      if (activeTab === 'Pendientes' && r.status !== 'Pendiente') return false;
      if (activeTab === 'Confirmadas' && r.status !== 'Confirmado') return false;
      if (activeTab === 'En negociación' && r.status !== 'Negociación') return false;
      if (
        activeTab === 'Canceladas' &&
        r.status !== 'Rechazado' &&
        r.status !== 'Cancelado'
      ) {
        return false;
      }
      if (activeTab === 'Marcadas' && r.status !== 'Marcada') return false;
      if (activeTab === 'Consolidadas' && r.status !== 'Consolidado') return false;

      // Date filter
      if (dateFilter && r.date !== dateFilter) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matches =
          r.fullName.toLowerCase().includes(q) ||
          (r.emailOrPhone || '').toLowerCase().includes(q) ||
          (r.id || '').toLowerCase().includes(q) ||
          (r.date || '').includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [reservations, activeTab, dateFilter, searchQuery]);

  if (!isOpen) return null;

  const clearSubAction = () => {
    setActionMode(null);
    setActionReason('');
    setAltDate('');
    setAltTime('');
    setAltNotes('');
    setForceOverrideSchedule(false);
  };

  const runAction = async (fn: () => Promise<unknown>, successText: string) => {
    setActionLoading(true);
    setActionFeedback(null);
    try {
      await fn();
      setActionFeedback({ type: 'success', text: successText });
      clearSubAction();
    } catch (err: any) {
      const msg =
        err?.message?.replace(/^Uncaught Error:\s*/i, '').trim() ||
        'No se pudo completar la operación.';
      setActionFeedback({ type: 'error', text: msg });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (staffSubmitting) return;
    setStaffSubmitting(true);
    setStaffFeedback(null);

    try {
      await createStaffRes({
        sessionToken,
        dvcCode,
        fullName: staffForm.fullName.trim(),
        emailOrPhone: staffForm.emailOrPhone.trim(),
        date: staffForm.date.trim(),
        time: staffForm.time.trim(),
        partySize: Number(staffForm.partySize) || 2,
        seatingArea: staffForm.seatingArea,
        source: staffForm.source,
        specialNotes: staffForm.specialNotes.trim() || undefined,
      });

      setStaffFeedback({
        type: 'success',
        text: 'Solicitud registrada correctamente en estado Pendiente.',
      });
      setStaffForm({
        fullName: '',
        emailOrPhone: '',
        date: new Date().toISOString().split('T')[0],
        time: '8:00 PM',
        partySize: 2,
        seatingArea: 'terraza',
        source: 'telefono',
        specialNotes: '',
      });
    } catch (err: any) {
      const msg =
        err?.message?.replace(/^Uncaught Error:\s*/i, '').trim() ||
        'Error al registrar la reservación.';
      setStaffFeedback({ type: 'error', text: msg });
    } finally {
      setStaffSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] bg-[#121212]/95 backdrop-blur-md flex flex-col overflow-hidden text-[#FFFBF2]">
      {/* Top Header */}
      <header className="border-b border-[#E9E2D6]/15 bg-[#1A1A1A] px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-serif text-lg sm:text-xl font-bold text-[#FFFBF2]">
              Gestión WEB de Reservaciones
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#E9E2D6]/70">
              <span>{user.fullName || user.name || user.username}</span>
              <span className="px-2 py-0.5 rounded bg-[#9B1B30]/25 text-[#E3B87C] font-semibold">
                {user.role}
              </span>
              <span className="font-mono text-[#8A8380]">{dvcCode}</span>
            </div>
          </div>
        </div>

        {/* Main 2 Options: GESTIÓN / SOLICITUD */}
        <div className="flex items-center gap-2 bg-[#121212] p-1 rounded-lg border border-[#E9E2D6]/15">
          <button
            type="button"
            onClick={() => setMainSection('gestion')}
            className={`px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors ${
              mainSection === 'gestion'
                ? 'bg-[#9B1B30] text-[#FFFBF2]'
                : 'text-[#E9E2D6]/70 hover:text-[#FFFBF2]'
            }`}
          >
            <LayoutGrid size={14} />
            <span>Gestión</span>
          </button>
          <button
            type="button"
            onClick={() => setMainSection('solicitud')}
            className={`px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors ${
              mainSection === 'solicitud'
                ? 'bg-[#9B1B30] text-[#FFFBF2]'
                : 'text-[#E9E2D6]/70 hover:text-[#FFFBF2]'
            }`}
          >
            <PlusCircle size={14} />
            <span>Solicitud</span>
          </button>
        </div>

        {/* Window & Session Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg border border-[#E9E2D6]/20 text-xs font-medium text-[#E9E2D6] hover:text-[#FFFBF2] hover:bg-[#2A2A2A] transition-colors flex items-center gap-1.5"
            title="Minimizar panel y ver la página pública"
          >
            <X size={14} />
            <span className="hidden sm:inline">Volver a la web</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-2 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-xs font-semibold uppercase tracking-wider text-red-200 transition-colors flex items-center gap-1.5"
          >
            <LogOut size={14} />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
        {mainSection === 'solicitud' ? (
          /* ================= SOLICITUD (PARA USUARIOS AUTORIZADOS) ================= */
          <div className="max-w-2xl mx-auto glass-panel-dark rounded-2xl p-6 sm:p-8 border border-[#E9E2D6]/15 space-y-6">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#FFFBF2]">
                Nueva Solicitud de Reservación
              </h2>
              <p className="text-xs text-[#E9E2D6]/70 mt-1">
                Registra solicitudes recibidas por teléfono, de forma presencial u otras vías.
              </p>
            </div>

            {staffFeedback && (
              <div
                className={`p-3.5 rounded-lg border text-xs flex items-center justify-between gap-3 ${
                  staffFeedback.type === 'success'
                    ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                    : 'bg-red-950/50 border-red-500/40 text-red-200'
                }`}
              >
                <span>{staffFeedback.text}</span>
                {staffFeedback.type === 'success' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMainSection('gestion');
                      setActiveTab('Pendientes');
                    }}
                    className="underline font-semibold shrink-0"
                  >
                    Ir a Pendientes
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleStaffSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#E9E2D6]/80 mb-1.5">
                    Nombre y Apellidos *
                  </label>
                  <input
                    type="text"
                    required
                    value={staffForm.fullName}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, fullName: e.target.value })
                    }
                    placeholder="Ej. María González"
                    className="w-full bg-[#121212] border border-[#E9E2D6]/20 rounded-lg px-3.5 py-2.5 text-sm text-[#FFFBF2] focus:outline-none focus:border-[#9B1B30]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#E9E2D6]/80 mb-1.5">
                    Teléfono o Correo *
                  </label>
                  <input
                    type="text"
                    required
                    value={staffForm.emailOrPhone}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, emailOrPhone: e.target.value })
                    }
                    placeholder="+53 55555555"
                    className="w-full bg-[#121212] border border-[#E9E2D6]/20 rounded-lg px-3.5 py-2.5 text-sm text-[#FFFBF2] focus:outline-none focus:border-[#9B1B30]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#E9E2D6]/80 mb-1.5">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    required
                    value={staffForm.date}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, date: e.target.value })
                    }
                    className="w-full bg-[#121212] border border-[#E9E2D6]/20 rounded-lg px-3.5 py-2.5 text-sm text-[#FFFBF2] focus:outline-none focus:border-[#9B1B30]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#E9E2D6]/80 mb-1.5">
                    Horario *
                  </label>
                  <select
                    value={staffForm.time}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, time: e.target.value })
                    }
                    className="w-full bg-[#121212] border border-[#E9E2D6]/20 rounded-lg px-3.5 py-2.5 text-sm text-[#FFFBF2] focus:outline-none focus:border-[#9B1B30]"
                  >
                    <option value="11:00 AM">11:00 AM</option>
                    <option value="12:00 PM">12:00 PM</option>
                    <option value="1:00 PM">1:00 PM</option>
                    <option value="2:00 PM">2:00 PM</option>
                    <option value="6:00 PM">6:00 PM</option>
                    <option value="7:00 PM">7:00 PM</option>
                    <option value="8:00 PM">8:00 PM</option>
                    <option value="9:00 PM">9:00 PM</option>
                    <option value="10:00 PM">10:00 PM</option>
                    <option value="11:00 PM">11:00 PM</option>
                    <option value="12:00 AM">12:00 AM</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#E9E2D6]/80 mb-1.5">
                    Personas *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    required
                    value={staffForm.partySize}
                    onChange={(e) =>
                      setStaffForm({
                        ...staffForm,
                        partySize: Number(e.target.value) || 1,
                      })
                    }
                    className="w-full bg-[#121212] border border-[#E9E2D6]/20 rounded-lg px-3.5 py-2.5 text-sm text-[#FFFBF2] focus:outline-none focus:border-[#9B1B30]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#E9E2D6]/80 mb-1.5">
                    Área
                  </label>
                  <select
                    value={staffForm.seatingArea}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, seatingArea: e.target.value })
                    }
                    className="w-full bg-[#121212] border border-[#E9E2D6]/20 rounded-lg px-3.5 py-2.5 text-sm text-[#FFFBF2] focus:outline-none focus:border-[#9B1B30]"
                  >
                    <option value="terraza">Terraza</option>
                    <option value="salon">Salón</option>
                    <option value="indiferente">Indiferente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#E9E2D6]/80 mb-1.5">
                    Vía de recepción
                  </label>
                  <select
                    value={staffForm.source}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, source: e.target.value })
                    }
                    className="w-full bg-[#121212] border border-[#E9E2D6]/20 rounded-lg px-3.5 py-2.5 text-sm text-[#FFFBF2] focus:outline-none focus:border-[#9B1B30]"
                  >
                    <option value="telefono">Teléfono</option>
                    <option value="presencial">Presencial</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="web_admin">WEB Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#E9E2D6]/80 mb-1.5">
                  Notas u observaciones
                </label>
                <textarea
                  rows={3}
                  value={staffForm.specialNotes}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, specialNotes: e.target.value })
                  }
                  placeholder="Celebración, preferencias de mesa, alergias..."
                  className="w-full bg-[#121212] border border-[#E9E2D6]/20 rounded-lg px-3.5 py-2.5 text-sm text-[#FFFBF2] focus:outline-none focus:border-[#9B1B30]"
                />
              </div>

              <button
                type="submit"
                disabled={staffSubmitting}
                className="w-full py-3.5 rounded-lg bg-[#9B1B30] hover:bg-[#801426] disabled:opacity-50 text-xs font-semibold uppercase tracking-wider text-[#FFFBF2] transition-colors flex items-center justify-center gap-2"
              >
                {staffSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Registrando...</span>
                  </>
                ) : (
                  <>
                    <PlusCircle size={16} />
                    <span>Registrar Solicitud</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* ================= GESTIÓN ================= */
          <>
            {/* Metrics & Navigation Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {(
                [
                  {
                    tab: 'Pendientes' as ManagementTab,
                    label: 'Pendientes',
                    count: stats?.totalPending ?? '—',
                    textClass: 'text-amber-300',
                    labelClass: 'text-amber-300/80',
                    idleBorder: 'border-amber-500/25 hover:border-amber-400/60',
                    activeClass: 'bg-amber-500/15 border-amber-400 ring-1 ring-amber-400/40',
                  },
                  {
                    tab: 'Confirmadas' as ManagementTab,
                    label: 'Confirmadas',
                    count: stats?.totalConfirmed ?? '—',
                    textClass: 'text-emerald-300',
                    labelClass: 'text-emerald-300/80',
                    idleBorder: 'border-emerald-500/25 hover:border-emerald-400/60',
                    activeClass: 'bg-emerald-500/15 border-emerald-400 ring-1 ring-emerald-400/40',
                  },
                  {
                    tab: 'En negociación' as ManagementTab,
                    label: 'En negociación',
                    count: stats?.totalNegotiation ?? '—',
                    textClass: 'text-indigo-300',
                    labelClass: 'text-indigo-300/80',
                    idleBorder: 'border-indigo-500/25 hover:border-indigo-400/60',
                    activeClass: 'bg-indigo-500/15 border-indigo-400 ring-1 ring-indigo-400/40',
                  },
                  {
                    tab: 'Canceladas' as ManagementTab,
                    label: 'Canceladas',
                    count: stats?.totalCancelled ?? '—',
                    textClass: 'text-red-300',
                    labelClass: 'text-red-300/80',
                    idleBorder: 'border-red-500/25 hover:border-red-400/60',
                    activeClass: 'bg-red-500/15 border-red-400 ring-1 ring-red-400/40',
                  },
                  {
                    tab: 'Marcadas' as ManagementTab,
                    label: 'Marcadas',
                    count: stats?.totalMarked ?? '—',
                    textClass: 'text-orange-300',
                    labelClass: 'text-orange-300/80',
                    idleBorder: 'border-orange-500/25 hover:border-orange-400/60',
                    activeClass: 'bg-orange-500/15 border-orange-400 ring-1 ring-orange-400/40',
                  },
                  {
                    tab: 'Consolidadas' as ManagementTab,
                    label: 'Consolidadas',
                    count: stats?.totalConsolidated ?? '—',
                    textClass: 'text-teal-300',
                    labelClass: 'text-teal-300/80',
                    idleBorder: 'border-teal-500/25 hover:border-teal-400/60',
                    activeClass: 'bg-teal-500/15 border-teal-400 ring-1 ring-teal-400/40',
                  },
                ] as const
              ).map((item) => {
                const isSelected = !showCustomers && activeTab === item.tab;
                return (
                  <button
                    key={item.tab}
                    type="button"
                    onClick={() => {
                      setShowCustomers(false);
                      setActiveTab(item.tab);
                      setSelectedReservationId(null);
                      clearSubAction();
                      setActionFeedback(null);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-colors ${
                      isSelected
                        ? item.activeClass
                        : `bg-[#1A1A1A] ${item.idleBorder}`
                    }`}
                  >
                    <span className={`text-[10px] uppercase tracking-wider ${item.labelClass} block`}>
                      {item.label}
                    </span>
                    <div className="flex items-center justify-between">
                      <strong className={`text-xl font-bold ${item.textClass}`}>
                        {item.count}
                      </strong>
                      <ChevronRight size={16} className={item.textClass} />
                    </div>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setShowCustomers(!showCustomers);
                  setSelectedCustomerId(null);
                }}
                className={`p-3.5 rounded-xl border text-left transition-colors ${
                  showCustomers
                    ? 'bg-[#9B1B30]/25 border-[#9B1B30]'
                    : 'bg-[#1A1A1A] border-[#E9E2D6]/15 hover:border-[#E3B87C]/50'
                }`}
              >
                <span className="text-[10px] uppercase tracking-wider text-[#E3B87C] block">
                  Clientes
                </span>
                <div className="flex items-center justify-between">
                  <strong className="text-xl font-bold text-[#FFFBF2]">
                    {stats?.totalUniqueCustomers ?? '—'}
                  </strong>
                  <ChevronRight size={16} className="text-[#E3B87C]" />
                </div>
              </button>
            </div>

            {showCustomers ? (
              /* ================= CLIENTES HABITUALES E HISTORIALES ================= */
              <div className="glass-panel-dark rounded-2xl p-6 border border-[#E9E2D6]/15 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E9E2D6]/10 pb-4">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-[#FFFBF2]">
                      Clientes Habituales e Historiales
                    </h2>
                    <p className="text-xs text-[#E9E2D6]/70">
                      Clientes recurrentes: {stats?.recurringCustomersCount ?? 0}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8380]"
                      />
                      <input
                        type="text"
                        placeholder="Buscar cliente..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="bg-[#121212] border border-[#E9E2D6]/20 rounded-lg pl-9 pr-3 py-2 text-xs text-[#FFFBF2] focus:outline-none focus:border-[#9B1B30]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCustomers(false)}
                      className="px-3 py-2 rounded-lg border border-[#E9E2D6]/20 text-xs hover:bg-[#2A2A2A]"
                    >
                      Volver a Reservaciones
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-5 space-y-2 max-h-[480px] overflow-y-auto pr-1">
                    {customers === undefined ? (
                      <div className="py-8 text-center text-xs text-[#8A8380]">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Cargando clientes...
                      </div>
                    ) : customers.length === 0 ? (
                      <p className="py-8 text-center text-xs text-[#8A8380]">
                        No se encontraron clientes registrados.
                      </p>
                    ) : (
                      customers.map((c: any) => (
                        <button
                          key={c._id}
                          type="button"
                          onClick={() => setSelectedCustomerId(c.id)}
                          className={`w-full text-left p-3.5 rounded-xl border transition-colors ${
                            selectedCustomerId === c.id
                              ? 'bg-[#9B1B30]/20 border-[#9B1B30]'
                              : 'bg-[#121212]/80 border-[#E9E2D6]/10 hover:border-[#E9E2D6]/30'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <strong className="text-sm text-[#FFFBF2]">
                              {c.fullName}
                            </strong>
                            <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[11px] font-semibold">
                              {c.totalVisits || 0} visitas
                            </span>
                          </div>
                          <div className="text-xs text-[#8A8380] mt-1">
                            {c.phone || c.email || 'Sin contacto'}
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="lg:col-span-7 bg-[#121212]/70 rounded-xl border border-[#E9E2D6]/10 p-5">
                    {!selectedCustomerId ? (
                      <div className="h-full flex items-center justify-center text-xs text-[#8A8380] py-12">
                        Selecciona un cliente para consultar su historial de reservaciones.
                      </div>
                    ) : customerDetails === undefined ? (
                      <div className="py-12 text-center text-xs text-[#8A8380]">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Cargando historial...
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-[#E9E2D6]/10 pb-3">
                          <div>
                            <h3 className="font-serif text-lg font-bold text-[#FFFBF2]">
                              {customerDetails.customer.fullName}
                            </h3>
                            <p className="text-xs text-[#8A8380]">
                              {customerDetails.customer.phone || ''}{' '}
                              {customerDetails.customer.email
                                ? `· ${customerDetails.customer.email}`
                                : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] uppercase text-[#8A8380] block">
                              Visitas Consolidadas
                            </span>
                            <strong className="text-lg text-teal-300">
                              {customerDetails.totalVisits}
                            </strong>
                          </div>
                        </div>

                        <div className="space-y-2 max-h-[340px] overflow-y-auto">
                          {customerDetails.reservations.map((res: any) => {
                            const meta = getReservationStatusMeta(res.status);
                            return (
                              <div
                                key={res._id}
                                className="p-3 rounded-lg bg-[#1A1A1A] border border-[#E9E2D6]/10 flex items-center justify-between gap-3 text-xs"
                              >
                                <div>
                                  <div className="font-semibold text-[#FFFBF2]">
                                    {res.date} · {res.time} ({res.partySize} pers.)
                                  </div>
                                  <div className="text-[#8A8380]">
                                    Área: {res.seatingArea || 'terraza'}
                                    {res.tableNumber ? ` · Mesa #${res.tableNumber}` : ''}
                                  </div>
                                </div>
                                <span
                                  className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold uppercase ${meta.badgeClass}`}
                                >
                                  {res.status}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* ================= APARTADOS DE RESERVACIONES ================= */
              <>
                {/* Search & Date Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A8380]"
                    />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, teléfono, correo, fecha o ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#1A1A1A] border border-[#E9E2D6]/15 rounded-lg pl-10 pr-4 py-2.5 text-sm text-[#FFFBF2] placeholder-[#8A8380] focus:outline-none focus:border-[#9B1B30]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="bg-[#1A1A1A] border border-[#E9E2D6]/15 rounded-lg px-3.5 py-2.5 text-sm text-[#FFFBF2] focus:outline-none focus:border-[#9B1B30]"
                    />
                    {dateFilter && (
                      <button
                        type="button"
                        onClick={() => setDateFilter('')}
                        className="px-3 py-2.5 rounded-lg bg-[#1A1A1A] border border-[#E9E2D6]/15 text-xs text-[#E9E2D6]/70 hover:text-[#FFFBF2]"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>

                {/* List + Detail Split */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* List Column */}
                  <div className="lg:col-span-5 space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                    {reservations === undefined ? (
                      <div className="py-12 text-center text-xs text-[#8A8380]">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#9B1B30]" />
                        Cargando reservaciones...
                      </div>
                    ) : filteredReservations.length === 0 ? (
                      <div className="py-12 text-center text-xs text-[#8A8380] bg-[#1A1A1A] rounded-xl border border-[#E9E2D6]/10">
                        No hay reservaciones en "{activeTab}".
                      </div>
                    ) : (
                      filteredReservations.map((r) => {
                        const meta = getReservationStatusMeta(r.status);
                        const isSelected =
                          selectedReservationId === r.id ||
                          selectedReservationId === r._id;
                        return (
                          <button
                            key={r._id}
                            type="button"
                            onClick={() => {
                              setSelectedReservationId(r.id);
                              clearSubAction();
                              setActionFeedback(null);
                            }}
                            className={`w-full text-left p-4 rounded-xl border transition-all ${
                              isSelected
                                ? 'bg-[#9B1B30]/15 border-[#9B1B30] shadow-md'
                                : 'bg-[#1A1A1A] border-[#E9E2D6]/10 hover:border-[#E9E2D6]/30'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-semibold text-sm text-[#FFFBF2]">
                                  {r.fullName}
                                </h3>
                                <p className="text-xs text-[#8A8380] mt-0.5">
                                  {r.emailOrPhone}
                                </p>
                              </div>
                              <span
                                className={`px-2.5 py-0.5 rounded-full border text-[10px] font-semibold uppercase shrink-0 ${meta.badgeClass}`}
                              >
                                {r.status}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-[#E9E2D6]/80">
                              <span className="flex items-center gap-1">
                                <Calendar size={12} className="text-[#9B1B30]" />
                                {r.date}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock size={12} className="text-[#9B1B30]" />
                                {r.time}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users size={12} className="text-[#9B1B30]" />
                                {r.partySize}
                              </span>
                              {r.tableNumber && (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-semibold text-[11px]">
                                  Mesa #{r.tableNumber}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Detail & Actions Column */}
                  <div className="lg:col-span-7 glass-panel-dark rounded-2xl p-6 border border-[#E9E2D6]/15">
                    {!selectedReservation ? (
                      <div className="py-16 text-center text-xs text-[#8A8380]">
                        Selecciona una reservación del listado para ver su detalle y gestionar su estado.
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {actionFeedback && (
                          <div
                            className={`p-3.5 rounded-lg border text-xs ${
                              actionFeedback.type === 'success'
                                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                                : 'bg-red-950/50 border-red-500/40 text-red-200'
                            }`}
                          >
                            {actionFeedback.text}
                          </div>
                        )}

                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E9E2D6]/10 pb-4">
                          <div>
                            <span className="font-mono text-[10px] text-[#8A8380]">
                              {selectedReservation.id}
                            </span>
                            <h2 className="font-serif text-2xl font-bold text-[#FFFBF2]">
                              {selectedReservation.fullName}
                            </h2>
                            <p className="text-xs text-[#E9E2D6]/80 flex items-center gap-2 mt-1">
                              <Phone size={12} className="text-[#9B1B30]" />
                              <span>{selectedReservation.emailOrPhone}</span>
                              <span>·</span>
                              <span className="capitalize">
                                Origen: {selectedReservation.source}
                              </span>
                            </p>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full border text-xs font-semibold uppercase ${
                              getReservationStatusMeta(selectedReservation.status)
                                .badgeClass
                            }`}
                          >
                            {selectedReservation.status}
                          </span>
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div className="p-3 rounded-lg bg-[#121212] border border-[#E9E2D6]/10">
                            <span className="text-[10px] uppercase text-[#8A8380] block">
                              Fecha
                            </span>
                            <strong className="text-[#FFFBF2]">
                              {selectedReservation.date}
                            </strong>
                          </div>
                          <div className="p-3 rounded-lg bg-[#121212] border border-[#E9E2D6]/10">
                            <span className="text-[10px] uppercase text-[#8A8380] block">
                              Horario
                            </span>
                            <strong className="text-[#FFFBF2]">
                              {selectedReservation.time}
                            </strong>
                          </div>
                          <div className="p-3 rounded-lg bg-[#121212] border border-[#E9E2D6]/10">
                            <span className="text-[10px] uppercase text-[#8A8380] block">
                              Comensales
                            </span>
                            <strong className="text-[#FFFBF2]">
                              {selectedReservation.partySize} personas
                            </strong>
                          </div>
                          <div className="p-3 rounded-lg bg-[#121212] border border-[#E9E2D6]/10">
                            <span className="text-[10px] uppercase text-[#8A8380] block">
                              Área / Mesa
                            </span>
                            <strong className="text-[#FFFBF2] capitalize">
                              {selectedReservation.seatingArea || 'terraza'}
                              {selectedReservation.tableNumber
                                ? ` · Mesa #${selectedReservation.tableNumber}`
                                : ''}
                            </strong>
                          </div>
                        </div>

                        {selectedReservation.specialNotes && (
                          <div className="p-3.5 rounded-lg bg-[#121212] border border-[#E9E2D6]/10 text-xs">
                            <span className="text-[10px] uppercase text-[#8A8380] block mb-1">
                              Notas / Observaciones
                            </span>
                            <p className="text-[#E9E2D6]/90">
                              {selectedReservation.specialNotes}
                            </p>
                          </div>
                        )}

                        {selectedReservation.status === 'Negociación' &&
                          (selectedReservation.alternativeDate ||
                            selectedReservation.alternativeTime) && (
                            <div className="p-3.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-xs space-y-1">
                              <span className="text-[10px] uppercase font-semibold text-indigo-300 block">
                                Propuesta Alternativa Activa
                              </span>
                              <p className="text-indigo-100">
                                {selectedReservation.alternativeDate} ·{' '}
                                {selectedReservation.alternativeTime}
                              </p>
                              {selectedReservation.alternativeNotes && (
                                <p className="text-indigo-200/80">
                                  {selectedReservation.alternativeNotes}
                                </p>
                              )}
                            </div>
                          )}

                        {(selectedReservation.status === 'Rechazado' ||
                          selectedReservation.status === 'Cancelado') &&
                          selectedReservation.rejectionReason && (
                            <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-500/30 text-xs">
                              <span className="text-[10px] uppercase font-semibold text-red-300 block mb-1">
                                Motivo
                              </span>
                              <p className="text-red-100">
                                {selectedReservation.rejectionReason}
                              </p>
                            </div>
                          )}

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-[#E9E2D6]/10">
                          {(selectedReservation.status === 'Pendiente' ||
                            selectedReservation.status === 'Negociación' ||
                            selectedReservation.status === 'Confirmado') && (
                            <button
                              type="button"
                              onClick={() =>
                                setActionMode(
                                  actionMode === 'assign_table'
                                    ? null
                                    : 'assign_table'
                                )
                              }
                              className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-xs font-semibold text-white flex items-center gap-1.5"
                            >
                              <CheckCircle2 size={14} />
                              <span>
                                {selectedReservation.status === 'Confirmado'
                                  ? 'Reasignar Mesa'
                                  : 'Asignar Mesa y Confirmar'}
                              </span>
                            </button>
                          )}

                          {(selectedReservation.status === 'Pendiente' ||
                            selectedReservation.status === 'Negociación') && (
                            <button
                              type="button"
                              onClick={() => {
                                setAltDate(selectedReservation.date);
                                setAltTime(selectedReservation.time);
                                setActionMode(
                                  actionMode === 'negotiate' ? null : 'negotiate'
                                );
                              }}
                              className="px-3.5 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-xs font-semibold text-white flex items-center gap-1.5"
                            >
                              <RefreshCw size={14} />
                              <span>Proponer Alternativa</span>
                            </button>
                          )}

                          {selectedReservation.status === 'Negociación' &&
                            (selectedReservation.alternativeDate ||
                              selectedReservation.alternativeTime) && (
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() =>
                                  runAction(
                                    () =>
                                      acceptAlternative({
                                        sessionToken,
                                        dvcCode,
                                        reservationId: selectedReservation.id,
                                      }),
                                    'Propuesta alternativa aceptada. La reservación volvió a Pendiente con la nueva fecha/hora.'
                                  )
                                }
                                className="px-3.5 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-xs font-semibold text-white flex items-center gap-1.5"
                              >
                                <Sparkles size={14} />
                                <span>Aceptar Propuesta</span>
                              </button>
                            )}

                          {selectedReservation.status === 'Confirmado' && (
                            <>
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() =>
                                  runAction(
                                    () =>
                                      consolidateRes({
                                        sessionToken,
                                        dvcCode,
                                        reservationId: selectedReservation.id,
                                      }),
                                    'Llegada consolidada y registrada en el historial del cliente.'
                                  )
                                }
                                className="px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-600 text-xs font-semibold text-white flex items-center gap-1.5"
                              >
                                <FileCheck2 size={14} />
                                <span>Consolidar Llegada</span>
                              </button>

                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() =>
                                  runAction(
                                    () =>
                                      markNoShow({
                                        sessionToken,
                                        dvcCode,
                                        reservationId: selectedReservation.id,
                                      }),
                                    'Reservación marcada como inasistencia.'
                                  )
                                }
                                className="px-3.5 py-2 rounded-lg bg-orange-700 hover:bg-orange-600 text-xs font-semibold text-white flex items-center gap-1.5"
                              >
                                <UserCheck size={14} />
                                <span>Marcar Inasistencia</span>
                              </button>
                            </>
                          )}

                          {selectedReservation.status !== 'Consolidado' &&
                            selectedReservation.status !== 'Rechazado' &&
                            selectedReservation.status !== 'Cancelado' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActionMode(
                                      actionMode === 'reject' ? null : 'reject'
                                    )
                                  }
                                  className="px-3.5 py-2 rounded-lg bg-red-800/80 hover:bg-red-700 text-xs font-semibold text-white flex items-center gap-1.5"
                                >
                                  <XCircle size={14} />
                                  <span>Rechazar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActionMode(
                                      actionMode === 'cancel' ? null : 'cancel'
                                    )
                                  }
                                  className="px-3.5 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs font-semibold text-white flex items-center gap-1.5"
                                >
                                  <Ban size={14} />
                                  <span>Cancelar</span>
                                </button>
                              </>
                            )}

                          {selectedReservation.status !== 'Consolidado' && (
                            <button
                              type="button"
                              onClick={() =>
                                setActionMode(
                                  actionMode === 'delete' ? null : 'delete'
                                )
                              }
                              className="px-3.5 py-2 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-950/60 text-xs font-semibold flex items-center gap-1.5 ml-auto"
                            >
                              <Trash2 size={14} />
                              <span>Eliminar</span>
                            </button>
                          )}
                        </div>

                        {/* ================= ACTION SUB-PANELS ================= */}
                        {actionMode === 'assign_table' && (
                          <div className="p-4 rounded-xl bg-[#121212] border border-emerald-500/30 space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                              Disponibilidad de Mesas (Bloqueo ±2h)
                            </h4>
                            {tableAvailability === undefined ? (
                              <div className="py-4 text-xs text-[#8A8380] flex items-center gap-2">
                                <Loader2 size={14} className="animate-spin" />
                                <span>Comprobando mesas disponibles...</span>
                              </div>
                            ) : (
                              <>
                                {!tableAvailability.isStoreOpen && (
                                  <div className="p-3 rounded-lg bg-amber-950/50 border border-amber-500/40 text-xs text-amber-200 space-y-2">
                                    <p>{tableAvailability.storeOpenReason}</p>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={forceOverrideSchedule}
                                        onChange={(e) =>
                                          setForceOverrideSchedule(e.target.checked)
                                        }
                                      />
                                      <span>Confirmar fuera de horario habitual</span>
                                    </label>
                                  </div>
                                )}

                                {tableAvailability.availableTables.length === 0 ? (
                                  <p className="text-xs text-amber-300">
                                    No hay mesas libres para este horario. Usa "Proponer Alternativa".
                                  </p>
                                ) : (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {tableAvailability.availableTables.map(
                                      (t: any) => (
                                        <button
                                          key={t.id}
                                          type="button"
                                          disabled={actionLoading}
                                          onClick={() =>
                                            runAction(
                                              () =>
                                                assignTableAndConfirm({
                                                  sessionToken,
                                                  dvcCode,
                                                  reservationId:
                                                    selectedReservation.id,
                                                  tableId: t.id,
                                                  forceOverrideSchedule,
                                                }),
                                              `Mesa #${t.number} asignada y reservación confirmada.`
                                            )
                                          }
                                          className="p-2.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-800/50 border border-emerald-500/30 text-left transition-colors"
                                        >
                                          <div className="text-xs font-bold text-[#FFFBF2]">
                                            {t.name || `Mesa ${t.number}`} (#
                                            {t.number})
                                          </div>
                                          <div className="text-[10px] text-emerald-300">
                                            Capacidad: {t.capacity} pers.
                                          </div>
                                        </button>
                                      )
                                    )}
                                  </div>
                                )}

                                {tableAvailability.unavailableTables.length > 0 && (
                                  <div className="pt-2 border-t border-[#E9E2D6]/10 space-y-1">
                                    <span className="text-[10px] uppercase text-[#8A8380] block">
                                      No disponibles:
                                    </span>
                                    {tableAvailability.unavailableTables.map(
                                      (t: any) => (
                                        <div
                                          key={t.id}
                                          className="text-[11px] text-[#8A8380]"
                                        >
                                          • Mesa #{t.number}: {t.reason}
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {actionMode === 'negotiate' && (
                          <div className="p-4 rounded-xl bg-[#121212] border border-indigo-500/30 space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                              Proponer Fecha / Hora Alternativa
                            </h4>

                            {alternativeSlots?.alternativeSlots &&
                              alternativeSlots.alternativeSlots.length > 0 && (
                                <div className="space-y-1.5">
                                  <span className="text-[10px] uppercase text-[#8A8380] block">
                                    Franjas libres sugeridas:
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {alternativeSlots.alternativeSlots
                                      .slice(0, 8)
                                      .map((slot: any, idx: number) => (
                                        <button
                                          key={`${slot.date}-${slot.time}-${idx}`}
                                          type="button"
                                          onClick={() => {
                                            setAltDate(slot.date);
                                            setAltTime(slot.time);
                                          }}
                                          className="px-2.5 py-1 rounded bg-indigo-950/60 hover:bg-indigo-800/60 border border-indigo-500/30 text-[11px] text-indigo-200"
                                        >
                                          {slot.date} · {slot.time} (
                                          {slot.availableTableCount} mesas)
                                        </button>
                                      ))}
                                  </div>
                                </div>
                              )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <input
                                type="date"
                                value={altDate}
                                onChange={(e) => setAltDate(e.target.value)}
                                className="bg-[#1A1A1A] border border-[#E9E2D6]/20 rounded-lg px-3 py-2 text-xs text-[#FFFBF2]"
                              />
                              <input
                                type="text"
                                placeholder="Ej. 9:00 PM o 21:00"
                                value={altTime}
                                onChange={(e) => setAltTime(e.target.value)}
                                className="bg-[#1A1A1A] border border-[#E9E2D6]/20 rounded-lg px-3 py-2 text-xs text-[#FFFBF2]"
                              />
                            </div>
                            <input
                              type="text"
                              placeholder="Nota para el cliente (opcional)"
                              value={altNotes}
                              onChange={(e) => setAltNotes(e.target.value)}
                              className="w-full bg-[#1A1A1A] border border-[#E9E2D6]/20 rounded-lg px-3 py-2 text-xs text-[#FFFBF2]"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={actionLoading || !altDate || !altTime}
                                onClick={() =>
                                  runAction(
                                    () =>
                                      updateStatus({
                                        sessionToken,
                                        dvcCode,
                                        id: selectedReservation.id,
                                        status: 'Negociación',
                                        alternativeDate: altDate,
                                        alternativeTime: altTime,
                                        alternativeNotes: altNotes || undefined,
                                      }),
                                    'Propuesta alternativa enviada. La reservación pasó a Negociación.'
                                  )
                                }
                                className="px-4 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-xs font-semibold text-white"
                              >
                                Enviar Propuesta
                              </button>
                              <button
                                type="button"
                                onClick={clearSubAction}
                                className="px-3 py-2 rounded-lg text-xs text-[#8A8380] hover:text-[#FFFBF2]"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}

                        {actionMode === 'reject' && (
                          <div className="p-4 rounded-xl bg-[#121212] border border-red-500/30 space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-red-300">
                              Rechazar Reservación
                            </h4>
                            <input
                              type="text"
                              placeholder="Motivo del rechazo (ej. Aforo completo)"
                              value={actionReason}
                              onChange={(e) => setActionReason(e.target.value)}
                              className="w-full bg-[#1A1A1A] border border-[#E9E2D6]/20 rounded-lg px-3 py-2 text-xs text-[#FFFBF2]"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() =>
                                  runAction(
                                    () =>
                                      updateStatus({
                                        sessionToken,
                                        dvcCode,
                                        id: selectedReservation.id,
                                        status: 'Rechazado',
                                        rejectionReason:
                                          actionReason.trim() ||
                                          'Capacidad no disponible',
                                      }),
                                    'Reservación rechazada.'
                                  )
                                }
                                className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-xs font-semibold text-white"
                              >
                                Confirmar Rechazo
                              </button>
                              <button
                                type="button"
                                onClick={clearSubAction}
                                className="px-3 py-2 rounded-lg text-xs text-[#8A8380] hover:text-[#FFFBF2]"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}

                        {actionMode === 'cancel' && (
                          <div className="p-4 rounded-xl bg-[#121212] border border-zinc-500/30 space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                              Cancelar Reservación
                            </h4>
                            <input
                              type="text"
                              placeholder="Motivo de cancelación (opcional)"
                              value={actionReason}
                              onChange={(e) => setActionReason(e.target.value)}
                              className="w-full bg-[#1A1A1A] border border-[#E9E2D6]/20 rounded-lg px-3 py-2 text-xs text-[#FFFBF2]"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() =>
                                  runAction(
                                    () =>
                                      updateStatus({
                                        sessionToken,
                                        dvcCode,
                                        id: selectedReservation.id,
                                        status: 'Cancelado',
                                        rejectionReason:
                                          actionReason.trim() || undefined,
                                      }),
                                    'Reservación marcada como Cancelada.'
                                  )
                                }
                                className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs font-semibold text-white"
                              >
                                Confirmar Cancelación
                              </button>
                              <button
                                type="button"
                                onClick={clearSubAction}
                                className="px-3 py-2 rounded-lg text-xs text-[#8A8380] hover:text-[#FFFBF2]"
                              >
                                Volver
                              </button>
                            </div>
                          </div>
                        )}

                        {actionMode === 'delete' && (
                          <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/40 space-y-3">
                            <p className="text-xs text-red-200">
                              ¿Estás seguro de eliminar permanentemente esta reservación? Esta acción no se puede deshacer.
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={async () => {
                                  await runAction(
                                    () =>
                                      deleteRes({
                                        sessionToken,
                                        dvcCode,
                                        id: selectedReservation.id,
                                      }),
                                    'Reservación eliminada.'
                                  );
                                  setSelectedReservationId(null);
                                }}
                                className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-xs font-semibold text-white"
                              >
                                Sí, Eliminar
                              </button>
                              <button
                                type="button"
                                onClick={clearSubAction}
                                className="px-3 py-2 rounded-lg text-xs text-[#8A8380] hover:text-[#FFFBF2]"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
