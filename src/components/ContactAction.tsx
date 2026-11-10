import React from 'react';
import { MessageSquare } from 'lucide-react';

interface ContactActionProps {
  phone: string;
  type: 'sms' | 'whatsapp';
  status: string;
  name: string;
  date: string;
  time: string;
}

export const ContactAction: React.FC<ContactActionProps> = ({
  phone,
  type,
  status,
  name,
  date,
  time,
}) => {
  const getMessage = () => {
    const base = `Hola ${name}, sobre tu reservación en Doña Gloria para el ${date} a las ${time}: `;
    switch (status) {
      case 'Pendiente':
        return `${base} hemos recibido tu solicitud y la estamos evaluando. Te avisaremos pronto.`;
      case 'Negociación':
        return `${base} tenemos una propuesta de horario alternativa. ¿Te interesa?`;
      case 'Confirmado':
        return `${base} ¡tu reservación ha sido confirmada! Te esperamos.`;
      case 'Rechazado':
      case 'Cancelado':
        return `${base} lamentablemente no podemos proceder con tu reservación.`;
      default:
        return `${base} tenemos una actualización sobre tu estado.`;
    }
  };

  const isPhoneValid = /^\+?[0-9\s-]{8,}$/.test(phone);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPhoneValid) {
        alert("Número de contacto no válido para enviar mensajes.");
        return;
    }
    const message = getMessage();
    if (type === 'sms') {
      window.open(`sms:${phone}?body=${encodeURIComponent(message)}`);
    } else {
      window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!isPhoneValid}
      className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase flex items-center gap-1.5 transition-colors ${
        isPhoneValid
          ? 'bg-[#1E1E1E] hover:bg-[#2A2A2A] text-[#E9E2D6] border border-[#E9E2D6]/20'
          : 'bg-[#121212] text-[#8A8380] cursor-not-allowed border border-transparent'
      }`}
    >
      <MessageSquare size={12} className={type === 'whatsapp' ? 'text-emerald-500' : 'text-[#9B1B30]'} />
      {type === 'sms' ? 'SMS' : 'WhatsApp'}
    </button>
  );
};
