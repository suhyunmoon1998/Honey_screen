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
    requestOtp: "Empecemos",
    verifyOtp: "Verificar codigo",
    onboardingTitle: "Antes de empezar",
    onboardingBody:
      "Confirma tu zona horaria para guardar tu progreso y regresar cuando quieras.",
    timeZoneLabel: "Zona horaria IANA",
    continueToDashboard: "Continuar al tablero",
    dashboardTitle: "Honey esta lista para investigar contigo",
    dashboardBody:
      "Tu progreso se guarda despues de cada respuesta para que puedas pausar y regresar sin perder informacion.",
    dashboardHubLabel: "Centro de misiones Honey",
    dashboardBriefLabel: "Honey dice",
    dashboardMobileReady: "Listo para movil",
    dashboardSafePace: "Ritmo diario seguro",
    dashboardConsoleLabel: "Consola de mision",
    dashboardChooseRoute: "Elige la ruta de hoy",
    dashboardDailyCapLabel: "Limite diario",
    dashboardActiveSlotLabel: "Mision activa",
    dashboardActiveSlotBody:
      "Retoma donde te quedaste. Tu progreso sigue vinculado a la mision actual.",
    dashboardMissionSelectLabel: "Seleccion de mision",
    dashboardHitsLabel: "preguntas",
    dashboardBossTeaserLabel: "Enemigo esperando",
    dashboardBossTeaserBody: "Cada respuesta le resta energia.",
    dashboardMissionCardBody:
      "Empieza un paso guiado de admision con Honey acompanandote.",
    dashboardComfortLabel: "Comodidad",
    dashboardComfortBody:
      "Sin perder rachas. Sin cuenta regresiva. Solo progreso diario estable.",
    dashboardPrivacyLabel: "Privacidad",
    dashboardPrivacyBody:
      "Los datos sensibles no aparecen en recordatorios push ni en respuestas almacenadas en cache.",
    quickMission: "Mision rapida de 3 preguntas",
    standardMission: "Mision estandar de 5 preguntas",
    fullMission: "Mision completa de hasta 12 preguntas",
    resumeMission: "Reanudar mision",
    missionProgress: "Mision {current} de {total}",
    missionQuestionLabel: "Pregunta de campo",
    missionSaveBody:
      "Honey guarda cada respuesta en el servidor inmediatamente.",
    dailyCapReached:
      "Ya completaste las preguntas disponibles por hoy. Puedes regresar cuando cambie tu fecha local.",
    dashboardProgressLabel: "Tu progreso",
    dashboardAllDoneTitle: "Terminaste todas las preguntas",
    dashboardAllDoneBody:
      "Gracias por compartir tu historia completa con Honey.",
    dashboardBackToDashboard: "Ver el tablero de misiones",
    completeMission: "Mision completada",
    missionVictoryTitle: "¡Victoria!",
    rewardTitle: "Honey gano una pista por tu participacion",
    notificationSettingsTitle: "Recordatorios de Honey",
    notificationSettingsBody:
      "Honey puede enviarte un recordatorio corto cuando haya preguntas disponibles. El mensaje no incluira informacion sobre tu trabajo ni tus respuestas.",
    notificationEnable: "Activar recordatorios",
    notificationDisable: "Desactivar recordatorios",
    notificationDisabledBody:
      "No recibiras recordatorios. Tus respuestas y tu progreso siguen guardados.",
    notificationPermissionDenied:
      "Tu navegador bloqueo los recordatorios. Puedes seguir usando la aplicacion normalmente.",
    notificationPreferredTime: "A que hora prefieres recibir un recordatorio?",
    notificationBrowserUnsupported:
      "Este navegador no puede mostrar recordatorios push.",
    notificationStatusPermissionDefault: "Permiso del navegador pendiente",
    notificationStatusPermissionGranted: "Permiso del navegador concedido",
    notificationStatusPermissionDenied: "Permiso del navegador bloqueado",
    notificationStatusSubscriptionActive: "Suscripcion activa en este momento",
    notificationStatusSubscriptionMissing: "Sin suscripcion activa",
    notificationStatusPreferenceEnabled: "Recordatorios activados",
    notificationStatusPreferenceDisabled: "Recordatorios desactivados",
    notificationStatusSimulated:
      "Entorno simulado de desarrollo o prueba para push",
    notificationTimeValidation:
      "Selecciona una hora permitida fuera del horario de silencio.",
    staffNotifications: "Notificaciones del equipo",
    signOut: "Cerrar sesion",
    switchLanguage: "English",
    callJackLabel: "Llamar a Jack",
    callJackBody: "Habla directo con nuestro equipo si tienes preguntas.",
  },
  en: {
    appName: "Honey Case Adventure",
    inviteTitle: "Start your mission with Honey",
    inviteBody:
      "Share information in short sessions. Sending this information does not mean JACKLAW has accepted your matter.",
    privacyConsent: "I accept the privacy notice.",
    messageConsent: "I accept transactional messages about my registration.",
    requestOtp: "Let's start",
    verifyOtp: "Verify code",
    onboardingTitle: "Before we begin",
    onboardingBody:
      "Confirm your time zone so we can save your progress and help you return later.",
    timeZoneLabel: "IANA time zone",
    continueToDashboard: "Continue to dashboard",
    dashboardTitle: "Honey is ready to investigate with you",
    dashboardBody:
      "Your progress is saved after each answer so you can pause and come back without losing information.",
    dashboardHubLabel: "Honey Mission Hub",
    dashboardBriefLabel: "Honey says",
    dashboardMobileReady: "Mobile Ready",
    dashboardSafePace: "Daily Safe Pace",
    dashboardConsoleLabel: "Mission Console",
    dashboardChooseRoute: "Choose today's route",
    dashboardDailyCapLabel: "Daily Cap",
    dashboardActiveSlotLabel: "Active Slot",
    dashboardActiveSlotBody:
      "Pick up where you left off. Your progress stays tied to the current mission slot.",
    dashboardMissionSelectLabel: "Mission Select",
    dashboardHitsLabel: "questions",
    dashboardBossTeaserLabel: "Enemy waiting",
    dashboardBossTeaserBody: "Every answer chips away its health.",
    dashboardMissionCardBody:
      "Start a focused intake step with Honey guiding the flow.",
    dashboardComfortLabel: "Comfort",
    dashboardComfortBody:
      "No streak loss. No pressure countdown. Steady daily progress only.",
    dashboardPrivacyLabel: "Privacy",
    dashboardPrivacyBody:
      "Sensitive details stay out of push text and cached responses.",
    quickMission: "Quick 3-question mission",
    standardMission: "Standard 5-question mission",
    fullMission: "Full mission with up to 12 questions",
    resumeMission: "Resume mission",
    missionProgress: "Mission {current} of {total}",
    missionQuestionLabel: "Field question",
    missionSaveBody: "Honey saves each answer on the server right away.",
    dailyCapReached:
      "You have already completed the questions available for today. You can come back when your local date changes.",
    dashboardProgressLabel: "Your progress",
    dashboardAllDoneTitle: "You finished every question",
    dashboardAllDoneBody: "Thank you for sharing your full story with Honey.",
    dashboardBackToDashboard: "View the mission board",
    completeMission: "Mission completed",
    missionVictoryTitle: "Victory!",
    rewardTitle: "Honey earned a clue for your participation",
    notificationSettingsTitle: "Honey reminders",
    notificationSettingsBody:
      "Honey can send a short reminder when questions are available. The message will not include information about your job or your answers.",
    notificationEnable: "Enable Honey reminders",
    notificationDisable: "Turn off reminders",
    notificationDisabledBody:
      "You will not receive reminders. Your answers and progress still stay saved.",
    notificationPermissionDenied:
      "Your browser blocked reminders. You can keep using the application normally.",
    notificationPreferredTime: "What time would you prefer a reminder?",
    notificationBrowserUnsupported: "This browser cannot show push reminders.",
    notificationStatusPermissionDefault: "Browser permission not requested yet",
    notificationStatusPermissionGranted: "Browser permission granted",
    notificationStatusPermissionDenied: "Browser permission blocked",
    notificationStatusSubscriptionActive: "Active subscription on file",
    notificationStatusSubscriptionMissing: "No active subscription",
    notificationStatusPreferenceEnabled: "Reminders enabled",
    notificationStatusPreferenceDisabled: "Reminders disabled",
    notificationStatusSimulated:
      "Simulated development or test environment for push",
    notificationTimeValidation: "Choose an allowed time outside quiet hours.",
    staffNotifications: "Team notifications",
    signOut: "Sign out",
    switchLanguage: "Español",
    callJackLabel: "Call Jack",
    callJackBody: "Talk directly with our team if you have questions.",
  },
} as const;

export type MessageKey = keyof (typeof messages)["es"];

export function t(locale: Locale, key: MessageKey) {
  return messages[locale][key];
}

export function getMessages(locale: Locale) {
  return messages[locale];
}
