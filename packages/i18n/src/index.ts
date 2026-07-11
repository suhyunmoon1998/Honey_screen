export type Locale = "es" | "en";

export const defaultLocale: Locale = "es";

const messages = {
  es: {
    appName: "Honey Case Adventure",
    inviteTitle: "Explora tu mision con Honey",
    inviteBody:
      "Comparte informacion en sesiones cortas. Enviar esta informacion no significa que JACKLAW haya aceptado tu asunto.",
    privacyConsent: "Acepto el aviso de privacidad.",
    messageConsent:
      "Acepto recibir mensajes transaccionales sobre mi registro.",
    requestOtp: "Enviar codigo",
    verifyOtp: "Verificar codigo",
    onboardingTitle: "Antes de empezar",
    onboardingBody:
      "Confirma tu zona horaria para guardar tu progreso y regresar cuando quieras.",
    timeZoneLabel: "Zona horaria IANA",
    continueToDashboard: "Continuar al tablero",
    dashboardTitle: "Honey esta lista para investigar contigo",
    dashboardBody:
      "Tu progreso se guarda despues de cada respuesta para que puedas pausar y regresar sin perder informacion.",
    quickMission: "Mision rapida de 3 preguntas",
    standardMission: "Mision estandar de 5 preguntas",
    fullMission: "Mision completa de hasta 10 preguntas",
    resumeMission: "Reanudar mision",
    missionProgress: "Mision {current} de {total}",
    missionSaveBody:
      "Honey guarda cada respuesta en el servidor inmediatamente.",
    dailyCapReached:
      "Ya completaste las preguntas disponibles por hoy. Puedes regresar cuando cambie tu fecha local.",
    completeMission: "Mision completada",
    rewardTitle: "Honey gano una pista por tu participacion",
    staffNotifications: "Notificaciones del equipo",
    signOut: "Cerrar sesion",
    switchLanguage: "English",
  },
  en: {
    appName: "Honey Case Adventure",
    inviteTitle: "Start your mission with Honey",
    inviteBody:
      "Share information in short sessions. Sending this information does not mean JACKLAW has accepted your matter.",
    privacyConsent: "I accept the privacy notice.",
    messageConsent: "I accept transactional messages about my registration.",
    requestOtp: "Send code",
    verifyOtp: "Verify code",
    onboardingTitle: "Before we begin",
    onboardingBody:
      "Confirm your time zone so we can save your progress and help you return later.",
    timeZoneLabel: "IANA time zone",
    continueToDashboard: "Continue to dashboard",
    dashboardTitle: "Honey is ready to investigate with you",
    dashboardBody:
      "Your progress is saved after each answer so you can pause and come back without losing information.",
    quickMission: "Quick 3-question mission",
    standardMission: "Standard 5-question mission",
    fullMission: "Full mission with up to 10 questions",
    resumeMission: "Resume mission",
    missionProgress: "Mission {current} of {total}",
    missionSaveBody: "Honey saves each answer on the server right away.",
    dailyCapReached:
      "You have already completed the questions available for today. You can come back when your local date changes.",
    completeMission: "Mission completed",
    rewardTitle: "Honey earned a clue for your participation",
    staffNotifications: "Team notifications",
    signOut: "Sign out",
    switchLanguage: "Español",
  },
} as const;

export type MessageKey = keyof (typeof messages)["es"];

export function t(locale: Locale, key: MessageKey) {
  return messages[locale][key];
}

export function getMessages(locale: Locale) {
  return messages[locale];
}
