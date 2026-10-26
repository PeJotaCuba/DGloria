/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DishItem {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  image: string;
  description: string;
  tag: string;
}

export const WHATSAPP_PHONE = '53431762';
export const WHATSAPP_URL_NUMBER = '5353431762'; // Cuba country code 53 + mobile 53431762

export const BUSINESS_INFO = {
  name: 'Doña Gloria Bar-Terraza',
  address: 'Calle José Antonio Saco, esquina Zenea',
  city: 'Bayamo',
  country: 'Cuba',
  fullAddress: 'Calle José Antonio Saco, esquina Zenea. Bayamo, Cuba',
  phone: '53431762',
  schedule: {
    weekday: 'Martes a Viernes: 11:00 AM — 3:00 PM | 6:00 PM — 12:00 AM',
    weekend: 'Sábados y Domingos: 11:00 AM — 3:00 PM | 6:00 PM — 2:00 AM',
    closed: 'Lunes: Cerrado por descanso',
  },
};

export const ASSETS = {
  // Commercial Logos
  logoTransparent: '/assets/aistudio/logo_transparent.png',
  logoLight: '/assets/aistudio/WhatsApp_Image_2026-09-28_at_4.23.01_PM-revisa-estas-imagenes-con-el-logo-de-un-bar-restau-dame-esta__1__eaf4b20c.jpg',
  logoDark: '/assets/aistudio/WhatsApp_Image_2026-09-28_at_4.23.01_PM-revisa-estas-imagenes-con-el-logo-de-un-bar-restau-dame-esta__2__379337b3.jpg',
  
  // Developer Agency Brand Logo (Nectys)
  nectysLogo: '/assets/aistudio/nectys_final.png',
  nectysLogoOriginal: '/assets/aistudio/4_Nectys_TRANSP_BLANCA_16x9_4K.png',

  // Immersive Background Photo (Full establishment terrace photo)
  establishmentBg: '/assets/aistudio/fondo.jpeg',

  // Verified Culinary Dishes (Real Documented Assets)
  dishes: [
    {
      id: 'hamburguesa-dona-gloria',
      title: 'Hamburguesa Especial de la Casa',
      subtitle: 'Acompañada de tostones crocantes aderezados',
      category: 'Especialidades de Terraza',
      image: '/assets/aistudio/Do_a_Gloria_1_a70d0bc0.jpeg',
      description: 'Hamburguesa artesanal de varias capas con quesos fundidos, salsas especiales de la casa y guarnición de tostones dorados en salsa ligera.',
      tag: 'Plato Insignia'
    },
    {
      id: 'bistec-cerdo-encebollado',
      title: 'Bistec de Cerdo Encebollado',
      subtitle: 'Guarnición de chatinos y ensalada fresca',
      category: 'Platos Fuertes',
      image: '/assets/aistudio/Bistec_de_cerdo_encebollado_acompa_ando_de_guarnici_n_de_chatinos_y_ensalada_c9c18d4f.jpeg',
      description: 'Tierno bistec de cerdo salteado con cebollas caramelizadas al punto, acompañado de crujientes chatinos con aderezo y ensalada de pepino con limón.',
      tag: 'Tradición Culinaria'
    },
    {
      id: 'coctel-de-camaron',
      title: 'Cóctel de Camarón',
      subtitle: 'Con toques tropicales y cítricos',
      category: 'Entrantes & Coctelería',
      image: '/assets/aistudio/C_ctel_de_camar_n_02e044d0.jpeg',
      description: 'Camarones selectos en copa con salsa rosada suave, dados de piña fresca confitada, rodaja de lima natural y brocheta decorada.',
      tag: 'De la Barra'
    }
  ] as DishItem[]
};

