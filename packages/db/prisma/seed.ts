import { getEnv, isDemoContentAllowedForEnvironment } from "@honey/config";
import {
  HONEY_REWARD_DEFINITIONS,
  hashPassword,
  hashToken,
} from "@honey/domain";
import { prisma } from "../src/index";

type SeedQuestion = {
  stableKey: string;
  category: string;
  promptEs: string;
  promptEn: string;
  answerType?: "BOOLEAN" | "TEXT" | "NUMBER";
  displayOrder: number;
  priority?: number;
  emotionalWeight?: number;
  estimatedEffort?: number;
  branchRules?: Array<{
    targetDefinitionKey: string;
    ruleJson: unknown;
    priority?: number;
  }>;
  reviewFlagRules?: Array<{
    flagType: string;
    ruleJson: unknown;
  }>;
};

const questionSeeds: SeedQuestion[] = [
  {
    stableKey: "employment.currently_employed",
    category: "employment_basics",
    promptEs:
      "Este contenido es ficticio para pruebas. Sigues trabajando para ese empleador actualmente?",
    promptEn:
      "This is fictional test content. Do you still work for that employer now?",
    displayOrder: 1,
    priority: 5,
  },
  {
    stableKey: "employment.job_title",
    category: "employment_basics",
    promptEs:
      "Este contenido es ficticio para pruebas. Cual era o es tu puesto principal?",
    promptEn:
      "This is fictional test content. What was or is your main job title?",
    answerType: "TEXT",
    displayOrder: 2,
  },
  {
    stableKey: "employment.start_date_known",
    category: "employment_basics",
    promptEs:
      "Este contenido es ficticio para pruebas. Recuerdas aproximadamente cuando empezaste ese trabajo?",
    promptEn:
      "This is fictional test content. Do you roughly remember when you started that job?",
    displayOrder: 3,
  },
  {
    stableKey: "schedule.shift_over_5h",
    category: "work_schedule",
    promptEs:
      "Este contenido es ficticio para pruebas. Tenias turnos de mas de 5 horas?",
    promptEn:
      "This is fictional test content. Did you have shifts longer than 5 hours?",
    displayOrder: 4,
    priority: 10,
  },
  {
    stableKey: "schedule.shift_over_8h",
    category: "work_schedule",
    promptEs:
      "Este contenido es ficticio para pruebas. Tenias turnos de mas de 8 horas?",
    promptEn:
      "This is fictional test content. Did you have shifts longer than 8 hours?",
    displayOrder: 5,
    priority: 12,
  },
  {
    stableKey: "schedule.weekly_hours",
    category: "work_schedule",
    promptEs:
      "Este contenido es ficticio para pruebas. Aproximadamente cuantas horas trabajabas por semana?",
    promptEn:
      "This is fictional test content. About how many hours did you work per week?",
    answerType: "NUMBER",
    displayOrder: 6,
    priority: 8,
  },
  {
    stableKey: "schedule.variable_schedule",
    category: "work_schedule",
    promptEs:
      "Este contenido es ficticio para pruebas. Tu horario cambiaba de una semana a otra?",
    promptEn:
      "This is fictional test content. Did your schedule change from week to week?",
    displayOrder: 7,
  },
  {
    stableKey: "timekeeping.clock_in_required",
    category: "timekeeping",
    promptEs:
      "Este contenido es ficticio para pruebas. Tenias que marcar entrada y salida?",
    promptEn:
      "This is fictional test content. Were you required to clock in and out?",
    displayOrder: 8,
  },
  {
    stableKey: "timekeeping.edit_time",
    category: "timekeeping",
    promptEs:
      "Este contenido es ficticio para pruebas. Alguien cambiaba tus horas registradas?",
    promptEn:
      "This is fictional test content. Did someone change your recorded hours?",
    displayOrder: 9,
    reviewFlagRules: [
      {
        flagType: "POSSIBLE_TIMEKEEPING_EDIT",
        ruleJson: {
          answerEquals: {
            questionKey: "timekeeping.edit_time",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "timekeeping.before_shift_tasks",
    category: "timekeeping",
    promptEs:
      "Este contenido es ficticio para pruebas. Hacias tareas antes de marcar entrada?",
    promptEn:
      "This is fictional test content. Did you do tasks before clocking in?",
    displayOrder: 10,
  },
  {
    stableKey: "meal.missed_meal",
    category: "meal_periods",
    promptEs:
      "Este contenido es ficticio para pruebas. Hubo dias en que no pudiste tomar comida completa?",
    promptEn:
      "This is fictional test content. Were there days when you could not take a full meal period?",
    displayOrder: 11,
    branchRules: [
      {
        targetDefinitionKey: "schedule.shift_over_5h",
        ruleJson: {
          answerEquals: {
            questionKey: "schedule.shift_over_5h",
            value: true,
          },
        },
      },
    ],
    reviewFlagRules: [
      {
        flagType: "POSSIBLE_MEAL_PERIOD_ISSUE",
        ruleJson: {
          answerEquals: {
            questionKey: "meal.missed_meal",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "meal.interrupted_meal",
    category: "meal_periods",
    promptEs:
      "Este contenido es ficticio para pruebas. A veces interrumpian tu comida para seguir trabajando?",
    promptEn:
      "This is fictional test content. Were your meal periods interrupted so you had to keep working?",
    displayOrder: 12,
    branchRules: [
      {
        targetDefinitionKey: "meal.missed_meal",
        ruleJson: {
          answerEquals: {
            questionKey: "meal.missed_meal",
            value: true,
          },
        },
      },
    ],
    reviewFlagRules: [
      {
        flagType: "POSSIBLE_INTERRUPTED_MEAL",
        ruleJson: {
          answerEquals: {
            questionKey: "meal.interrupted_meal",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "meal.short_meal",
    category: "meal_periods",
    promptEs:
      "Este contenido es ficticio para pruebas. Tus comidas duraban menos de lo que te decian?",
    promptEn:
      "This is fictional test content. Did your meal periods end up shorter than expected?",
    displayOrder: 13,
    branchRules: [
      {
        targetDefinitionKey: "schedule.shift_over_5h",
        ruleJson: {
          answerEquals: {
            questionKey: "schedule.shift_over_5h",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "rest.missed_break",
    category: "rest_breaks",
    promptEs:
      "Este contenido es ficticio para pruebas. Habia dias en que no tomabas descanso?",
    promptEn:
      "This is fictional test content. Were there days when you did not get a rest break?",
    displayOrder: 14,
    reviewFlagRules: [
      {
        flagType: "POSSIBLE_REST_BREAK_ISSUE",
        ruleJson: {
          answerEquals: {
            questionKey: "rest.missed_break",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "rest.on_call_break",
    category: "rest_breaks",
    promptEs:
      "Este contenido es ficticio para pruebas. Durante el descanso tenias que quedarte pendiente del trabajo?",
    promptEn:
      "This is fictional test content. During breaks, did you still have to stay on call for work?",
    displayOrder: 15,
  },
  {
    stableKey: "rest.break_interrupted",
    category: "rest_breaks",
    promptEs:
      "Este contenido es ficticio para pruebas. Interrumpian tus descansos para atender trabajo?",
    promptEn:
      "This is fictional test content. Were your breaks interrupted to handle work?",
    displayOrder: 16,
  },
  {
    stableKey: "offclock.work_after_clockout",
    category: "off_the_clock",
    promptEs:
      "Este contenido es ficticio para pruebas. Alguna vez trabajaste despues de marcar salida?",
    promptEn:
      "This is fictional test content. Did you ever work after clocking out?",
    displayOrder: 17,
    priority: 11,
    reviewFlagRules: [
      {
        flagType: "POSSIBLE_OFF_THE_CLOCK",
        ruleJson: {
          answerEquals: {
            questionKey: "offclock.work_after_clockout",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "offclock.work_before_clockin",
    category: "off_the_clock",
    promptEs:
      "Este contenido es ficticio para pruebas. Alguna vez trabajaste antes de marcar entrada?",
    promptEn:
      "This is fictional test content. Did you ever work before clocking in?",
    displayOrder: 18,
    reviewFlagRules: [
      {
        flagType: "POSSIBLE_OFF_THE_CLOCK",
        ruleJson: {
          answerEquals: {
            questionKey: "offclock.work_before_clockin",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "offclock.messages_after_hours",
    category: "off_the_clock",
    promptEs:
      "Este contenido es ficticio para pruebas. Tenias que contestar mensajes o llamadas fuera de horario?",
    promptEn:
      "This is fictional test content. Did you have to answer messages or calls after hours?",
    displayOrder: 19,
  },
  {
    stableKey: "overtime.over_40_week",
    category: "overtime",
    promptEs:
      "Este contenido es ficticio para pruebas. Hubo semanas con mas de 40 horas trabajadas?",
    promptEn:
      "This is fictional test content. Were there weeks when you worked more than 40 hours?",
    displayOrder: 20,
    reviewFlagRules: [
      {
        flagType: "POSSIBLE_OVERTIME",
        ruleJson: {
          answerEquals: {
            questionKey: "overtime.over_40_week",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "overtime.paid_ot",
    category: "overtime",
    promptEs:
      "Este contenido es ficticio para pruebas. Cuando trabajabas horas extra, te las pagaban como extra?",
    promptEn:
      "This is fictional test content. When you worked overtime, were you paid overtime rates?",
    displayOrder: 21,
    branchRules: [
      {
        targetDefinitionKey: "overtime.over_40_week",
        ruleJson: {
          answerEquals: {
            questionKey: "overtime.over_40_week",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "overtime.daily_long_shift",
    category: "overtime",
    promptEs:
      "Este contenido es ficticio para pruebas. Habia dias de jornadas especialmente largas?",
    promptEn:
      "This is fictional test content. Were there days with especially long shifts?",
    displayOrder: 22,
    branchRules: [
      {
        targetDefinitionKey: "schedule.shift_over_8h",
        ruleJson: {
          answerEquals: {
            questionKey: "schedule.shift_over_8h",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "pay.hourly_rate_known",
    category: "pay_rate",
    promptEs:
      "Este contenido es ficticio para pruebas. Sabias cual era tu tarifa por hora o salario base?",
    promptEn:
      "This is fictional test content. Did you know your hourly rate or base pay?",
    displayOrder: 23,
  },
  {
    stableKey: "pay.cash_or_card",
    category: "pay_rate",
    promptEs:
      "Este contenido es ficticio para pruebas. Te pagaban por deposito, cheque, tarjeta o efectivo?",
    promptEn:
      "This is fictional test content. Were you paid by direct deposit, check, card, or cash?",
    answerType: "TEXT",
    displayOrder: 24,
  },
  {
    stableKey: "pay.final_pay_issue",
    category: "pay_rate",
    promptEs:
      "Este contenido es ficticio para pruebas. Hubo algun problema con tu ultimo pago?",
    promptEn:
      "This is fictional test content. Was there any problem with your final pay?",
    displayOrder: 25,
    branchRules: [
      {
        targetDefinitionKey: "termination.employment_ended",
        ruleJson: {
          answerEquals: {
            questionKey: "termination.employment_ended",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "wage.paystubs_received",
    category: "wage_statements",
    promptEs:
      "Este contenido es ficticio para pruebas. Recibias comprobantes o talones de pago?",
    promptEn:
      "This is fictional test content. Did you receive pay stubs or wage statements?",
    displayOrder: 26,
  },
  {
    stableKey: "wage.paystubs_missing_hours",
    category: "wage_statements",
    promptEs:
      "Este contenido es ficticio para pruebas. Tus talones mostraban horas o datos incompletos?",
    promptEn:
      "This is fictional test content. Did your wage statements show incomplete hours or information?",
    displayOrder: 27,
  },
  {
    stableKey: "wage.paystubs_missed_break_premium",
    category: "wage_statements",
    promptEs:
      "Este contenido es ficticio para pruebas. En tus talones aparecia algun pago adicional por comidas o descansos perdidos?",
    promptEn:
      "This is fictional test content. Did your wage statements show any extra pay for missed meal or rest periods?",
    displayOrder: 28,
  },
  {
    stableKey: "reimburse.uniform_costs",
    category: "reimbursements",
    promptEs:
      "Este contenido es ficticio para pruebas. Pagaste de tu bolsillo uniforme o herramientas requeridas?",
    promptEn:
      "This is fictional test content. Did you pay out of pocket for required uniforms or tools?",
    displayOrder: 29,
  },
  {
    stableKey: "reimburse.vehicle_use",
    category: "reimbursements",
    promptEs:
      "Este contenido es ficticio para pruebas. Usabas tu propio carro o telefono para trabajo sin reembolso?",
    promptEn:
      "This is fictional test content. Did you use your own car or phone for work without reimbursement?",
    displayOrder: 30,
  },
  {
    stableKey: "reimburse.supplies",
    category: "reimbursements",
    promptEs:
      "Este contenido es ficticio para pruebas. Compraste materiales o suministros para el trabajo?",
    promptEn:
      "This is fictional test content. Did you buy materials or supplies for work?",
    displayOrder: 31,
  },
  {
    stableKey: "termination.employment_ended",
    category: "termination",
    promptEs:
      "Este contenido es ficticio para pruebas. Tu relacion de trabajo ya termino?",
    promptEn: "This is fictional test content. Has your employment ended?",
    displayOrder: 32,
    priority: 14,
  },
  {
    stableKey: "termination.fired_or_quit",
    category: "termination",
    promptEs:
      "Este contenido es ficticio para pruebas. Sentiste que fue despido, renuncia o algo intermedio?",
    promptEn:
      "This is fictional test content. Did it feel more like a firing, a resignation, or something in between?",
    answerType: "TEXT",
    displayOrder: 33,
    branchRules: [
      {
        targetDefinitionKey: "termination.employment_ended",
        ruleJson: {
          answerEquals: {
            questionKey: "termination.employment_ended",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "termination.final_day_known",
    category: "termination",
    promptEs:
      "Este contenido es ficticio para pruebas. Recuerdas la fecha aproximada de tu ultimo dia?",
    promptEn:
      "This is fictional test content. Do you remember the approximate date of your last day?",
    displayOrder: 34,
    branchRules: [
      {
        targetDefinitionKey: "termination.employment_ended",
        ruleJson: {
          answerEquals: {
            questionKey: "termination.employment_ended",
            value: true,
          },
        },
      },
    ],
    reviewFlagRules: [
      {
        flagType: "LIMITATIONS_REVIEW",
        ruleJson: {
          answerEquals: {
            questionKey: "termination.employment_ended",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "retaliation.complaint_made",
    category: "retaliation",
    promptEs:
      "Este contenido es ficticio para pruebas. Antes del problema, hablaste o te quejaste sobre pago, horarios o trato?",
    promptEn:
      "This is fictional test content. Before the problem happened, did you speak up or complain about pay, scheduling, or treatment?",
    displayOrder: 35,
  },
  {
    stableKey: "retaliation.changed_after_complaint",
    category: "retaliation",
    promptEs:
      "Este contenido es ficticio para pruebas. Despues de hablar, te cambiaron horas, trato o condiciones?",
    promptEn:
      "This is fictional test content. After you spoke up, did your hours, treatment, or conditions change?",
    displayOrder: 36,
    branchRules: [
      {
        targetDefinitionKey: "retaliation.complaint_made",
        ruleJson: {
          answerEquals: {
            questionKey: "retaliation.complaint_made",
            value: true,
          },
        },
      },
    ],
    reviewFlagRules: [
      {
        flagType: "POSSIBLE_RETALIATION",
        ruleJson: {
          answerEquals: {
            questionKey: "retaliation.changed_after_complaint",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "leave.medical_condition",
    category: "leave",
    promptEs:
      "Este contenido es ficticio para pruebas. Hubo alguna condicion medica, embarazo o necesidad de cuidado que afectara tu trabajo?",
    promptEn:
      "This is fictional test content. Was there any medical condition, pregnancy, or caregiving need that affected your work?",
    displayOrder: 37,
    emotionalWeight: 4,
  },
  {
    stableKey: "leave.time_off_requested",
    category: "leave",
    promptEs:
      "Este contenido es ficticio para pruebas. Pediste tiempo libre, cambios o apoyo por esa situacion?",
    promptEn:
      "This is fictional test content. Did you ask for time off, changes, or support for that situation?",
    displayOrder: 38,
    emotionalWeight: 4,
    branchRules: [
      {
        targetDefinitionKey: "leave.medical_condition",
        ruleJson: {
          answerEquals: {
            questionKey: "leave.medical_condition",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "leave.denied_or_punished",
    category: "leave",
    promptEs:
      "Este contenido es ficticio para pruebas. Sientes que te negaron apoyo o te castigaron por pedirlo?",
    promptEn:
      "This is fictional test content. Do you feel support was denied or that you were punished for asking?",
    displayOrder: 39,
    emotionalWeight: 4,
    branchRules: [
      {
        targetDefinitionKey: "leave.time_off_requested",
        ruleJson: {
          answerEquals: {
            questionKey: "leave.time_off_requested",
            value: true,
          },
        },
      },
    ],
    reviewFlagRules: [
      {
        flagType: "POSSIBLE_DISABILITY_OR_LEAVE",
        ruleJson: {
          answerEquals: {
            questionKey: "leave.denied_or_punished",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "discrimination.unfair_treatment",
    category: "discrimination",
    promptEs:
      "Este contenido es ficticio para pruebas. Sentiste trato injusto por una parte importante de quien eres?",
    promptEn:
      "This is fictional test content. Did you feel you were treated unfairly because of an important part of who you are?",
    displayOrder: 40,
    emotionalWeight: 5,
  },
  {
    stableKey: "harassment.repeated_comments",
    category: "harassment",
    promptEs:
      "Este contenido es ficticio para pruebas. Hubo comentarios o conductas repetidas que te hicieron sentir incomodidad o inseguridad?",
    promptEn:
      "This is fictional test content. Were there repeated comments or conduct that made you feel uncomfortable or unsafe?",
    displayOrder: 41,
    emotionalWeight: 5,
    reviewFlagRules: [
      {
        flagType: "POSSIBLE_HARASSMENT_OR_DISCRIMINATION",
        ruleJson: {
          answerEquals: {
            questionKey: "harassment.repeated_comments",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "witnesses.people_saw_events",
    category: "witnesses",
    promptEs:
      "Este contenido es ficticio para pruebas. Hay companeros u otras personas que vieron parte de lo ocurrido?",
    promptEn:
      "This is fictional test content. Are there coworkers or other people who saw part of what happened?",
    displayOrder: 42,
  },
  {
    stableKey: "witnesses.names_known",
    category: "witnesses",
    promptEs:
      "Este contenido es ficticio para pruebas. Recuerdas los nombres de algunas de esas personas?",
    promptEn:
      "This is fictional test content. Do you remember the names of any of those people?",
    displayOrder: 43,
    branchRules: [
      {
        targetDefinitionKey: "witnesses.people_saw_events",
        ruleJson: {
          answerEquals: {
            questionKey: "witnesses.people_saw_events",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "evidence.has_texts",
    category: "evidence",
    promptEs:
      "Este contenido es ficticio para pruebas. Tienes mensajes, correos o fotos relacionados con horarios, pago o trato?",
    promptEn:
      "This is fictional test content. Do you have messages, emails, or photos related to schedules, pay, or treatment?",
    displayOrder: 44,
    reviewFlagRules: [
      {
        flagType: "EVIDENCE_AVAILABLE",
        ruleJson: {
          answerEquals: {
            questionKey: "evidence.has_texts",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "evidence.has_pay_records",
    category: "evidence",
    promptEs:
      "Este contenido es ficticio para pruebas. Guardaste talones, horarios o registros de horas?",
    promptEn:
      "This is fictional test content. Did you keep pay stubs, schedules, or hour records?",
    displayOrder: 45,
  },
  {
    stableKey: "evidence.still_employed_privacy_caution",
    category: "evidence",
    promptEs:
      "Este contenido es ficticio para pruebas. Como sigues trabajando alli, prefieres mas cuidado antes de compartir documentos o mensajes?",
    promptEn:
      "This is fictional test content. Since you still work there, would you prefer extra caution before sharing documents or messages?",
    displayOrder: 46,
    branchRules: [
      {
        targetDefinitionKey: "employment.currently_employed",
        ruleJson: {
          answerEquals: {
            questionKey: "employment.currently_employed",
            value: true,
          },
        },
      },
    ],
    reviewFlagRules: [
      {
        flagType: "CURRENT_EMPLOYEE_PRIVACY_CAUTION",
        ruleJson: {
          answerEquals: {
            questionKey: "evidence.still_employed_privacy_caution",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "contact.best_channel_text",
    category: "contact_preferences",
    promptEs:
      "Este contenido es ficticio para pruebas. Te sientes comoda o comodo recibiendo mensajes de texto para seguimiento?",
    promptEn:
      "This is fictional test content. Do you feel comfortable receiving follow-up by text message?",
    displayOrder: 47,
  },
  {
    stableKey: "contact.safe_time_call",
    category: "contact_preferences",
    promptEs:
      "Este contenido es ficticio para pruebas. Hay algun horario mas seguro para una llamada del equipo?",
    promptEn:
      "This is fictional test content. Is there a safer time for a team call?",
    answerType: "TEXT",
    displayOrder: 48,
  },
  {
    stableKey: "contact.english_preferred",
    category: "contact_preferences",
    promptEs:
      "Este contenido es ficticio para pruebas. Prefieres continuar en ingles en algun momento?",
    promptEn:
      "This is fictional test content. Would you prefer to continue in English at any point?",
    displayOrder: 49,
  },
  {
    stableKey: "urgency.recent_deadline",
    category: "urgency",
    promptEs:
      "Este contenido es ficticio para pruebas. Paso algo importante recientemente que te preocupa por tiempo o urgencia?",
    promptEn:
      "This is fictional test content. Did something important happen recently that makes timing feel urgent?",
    displayOrder: 50,
    reviewFlagRules: [
      {
        flagType: "LIMITATIONS_REVIEW",
        ruleJson: {
          answerEquals: {
            questionKey: "urgency.recent_deadline",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "urgency.government_notice",
    category: "urgency",
    promptEs:
      "Este contenido es ficticio para pruebas. Recibiste algun aviso oficial, carta o fecha de audiencia?",
    promptEn:
      "This is fictional test content. Did you receive any official notice, letter, or hearing date?",
    displayOrder: 51,
    reviewFlagRules: [
      {
        flagType: "LIMITATIONS_REVIEW",
        ruleJson: {
          answerEquals: {
            questionKey: "urgency.government_notice",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "urgency.last_pay_issue_recent",
    category: "urgency",
    promptEs:
      "Este contenido es ficticio para pruebas. El problema de pago o salida paso en los ultimos meses?",
    promptEn:
      "This is fictional test content. Did the pay or separation problem happen in the last few months?",
    displayOrder: 52,
  },
  {
    stableKey: "employment.supervisor_contact",
    category: "employment_basics",
    promptEs:
      "Este contenido es ficticio para pruebas. Recuerdas quien supervisaba tu trabajo normalmente?",
    promptEn:
      "This is fictional test content. Do you remember who usually supervised your work?",
    answerType: "TEXT",
    displayOrder: 53,
  },
  {
    stableKey: "schedule.weekend_work",
    category: "work_schedule",
    promptEs:
      "Este contenido es ficticio para pruebas. Trabajabas fines de semana con frecuencia?",
    promptEn: "This is fictional test content. Did you often work weekends?",
    displayOrder: 54,
  },
  {
    stableKey: "timekeeping.offsite_work",
    category: "timekeeping",
    promptEs:
      "Este contenido es ficticio para pruebas. Alguna parte del trabajo se hacia fuera del lugar principal?",
    promptEn:
      "This is fictional test content. Was any part of your work done away from the main job site?",
    displayOrder: 55,
  },
  {
    stableKey: "meal.second_meal_issue",
    category: "meal_periods",
    promptEs:
      "Este contenido es ficticio para pruebas. En turnos muy largos, tambien faltaba una segunda comida?",
    promptEn:
      "This is fictional test content. On very long shifts, was a second meal period also missing?",
    displayOrder: 56,
    branchRules: [
      {
        targetDefinitionKey: "schedule.shift_over_8h",
        ruleJson: {
          answerEquals: {
            questionKey: "schedule.shift_over_8h",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "rest.pressured_skip_break",
    category: "rest_breaks",
    promptEs:
      "Este contenido es ficticio para pruebas. Te hacian sentir presion para saltarte descansos?",
    promptEn:
      "This is fictional test content. Did you feel pressure to skip breaks?",
    displayOrder: 57,
  },
  {
    stableKey: "offclock.security_checks",
    category: "off_the_clock",
    promptEs:
      "Este contenido es ficticio para pruebas. Tenias que esperar revision, cierre o seguridad sin pago?",
    promptEn:
      "This is fictional test content. Did you have to wait for security checks or closing tasks without pay?",
    displayOrder: 58,
  },
  {
    stableKey: "overtime.manager_approved_only",
    category: "overtime",
    promptEs:
      "Este contenido es ficticio para pruebas. Solo pagaban horas extra si habia aprobacion previa?",
    promptEn:
      "This is fictional test content. Was overtime paid only if it was approved in advance?",
    displayOrder: 59,
  },
  {
    stableKey: "pay.tip_or_bonus_issues",
    category: "pay_rate",
    promptEs:
      "Este contenido es ficticio para pruebas. Hubo problemas con propinas, bonos o comisiones?",
    promptEn:
      "This is fictional test content. Were there problems with tips, bonuses, or commissions?",
    displayOrder: 60,
  },
  {
    stableKey: "reimburse.mileage",
    category: "reimbursements",
    promptEs:
      "Este contenido es ficticio para pruebas. Te reembolsaban millaje cuando usabas tu carro?",
    promptEn:
      "This is fictional test content. Were you reimbursed for mileage when you used your car?",
    displayOrder: 61,
  },
  {
    stableKey: "termination.exit_explanation",
    category: "termination",
    promptEs:
      "Este contenido es ficticio para pruebas. Te dieron alguna explicacion clara al terminar el trabajo?",
    promptEn:
      "This is fictional test content. Were you given a clear explanation when the job ended?",
    displayOrder: 62,
    branchRules: [
      {
        targetDefinitionKey: "termination.employment_ended",
        ruleJson: {
          answerEquals: {
            questionKey: "termination.employment_ended",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "retaliation.schedule_cut",
    category: "retaliation",
    promptEs:
      "Este contenido es ficticio para pruebas. Despues de hablar, te redujeron horas o te apartaron del horario?",
    promptEn:
      "This is fictional test content. After you spoke up, were your hours cut or were you taken off the schedule?",
    displayOrder: 63,
    branchRules: [
      {
        targetDefinitionKey: "retaliation.complaint_made",
        ruleJson: {
          answerEquals: {
            questionKey: "retaliation.complaint_made",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "leave.return_restrictions",
    category: "leave",
    promptEs:
      "Este contenido es ficticio para pruebas. Al volver, te pusieron condiciones que te parecieron injustas?",
    promptEn:
      "This is fictional test content. When you returned, were you given conditions that felt unfair?",
    displayOrder: 64,
    emotionalWeight: 4,
    branchRules: [
      {
        targetDefinitionKey: "leave.time_off_requested",
        ruleJson: {
          answerEquals: {
            questionKey: "leave.time_off_requested",
            value: true,
          },
        },
      },
    ],
  },
  {
    stableKey: "discrimination.reported_internally",
    category: "discrimination",
    promptEs:
      "Este contenido es ficticio para pruebas. Pudiste reportar ese trato dentro del trabajo?",
    promptEn:
      "This is fictional test content. Were you able to report that treatment inside the workplace?",
    displayOrder: 65,
    emotionalWeight: 4,
  },
  {
    stableKey: "evidence.policy_documents",
    category: "evidence",
    promptEs:
      "Este contenido es ficticio para pruebas. Tienes manuales, politicas o mensajes sobre descansos, pago o asistencia?",
    promptEn:
      "This is fictional test content. Do you have manuals, policies, or messages about breaks, pay, or attendance?",
    displayOrder: 66,
  },
];

async function upsertQuestionVersion(
  question: SeedQuestion,
  organizationId: string,
  adminId: string,
) {
  const definition = await prisma.questionDefinition.upsert({
    where: { stableKey: question.stableKey },
    update: {
      category: question.category,
      isAdministrative: false,
    },
    create: {
      organizationId,
      stableKey: question.stableKey,
      category: question.category,
      isAdministrative: false,
    },
  });

  let version = await prisma.questionVersion.findFirst({
    where: {
      definitionId: definition.id,
      versionNumber: 1,
    },
  });

  if (!version) {
    version = await prisma.questionVersion.create({
      data: {
        definitionId: definition.id,
        versionNumber: 1,
        promptEs: question.promptEs,
        promptEn: question.promptEn,
        answerType: question.answerType ?? "BOOLEAN",
        category: question.category,
        priority: question.priority ?? 100,
        emotionalWeight: question.emotionalWeight ?? 1,
        estimatedEffort: question.estimatedEffort ?? 1,
        legalReviewStatus: "APPROVED",
        displayOrder: question.displayOrder,
        fictionalSeed: true,
        createdByStaffId: adminId,
        approvedByStaffId: adminId,
        approvedAt: new Date("2026-07-11T00:00:00.000Z"),
      },
    });
  } else {
    version = await prisma.questionVersion.update({
      where: { id: version.id },
      data: {
        promptEs: question.promptEs,
        promptEn: question.promptEn,
        answerType: question.answerType ?? "BOOLEAN",
        category: question.category,
        priority: question.priority ?? 100,
        emotionalWeight: question.emotionalWeight ?? 1,
        estimatedEffort: question.estimatedEffort ?? 1,
        legalReviewStatus: "APPROVED",
        displayOrder: question.displayOrder,
        fictionalSeed: true,
        createdByStaffId: adminId,
        approvedByStaffId: adminId,
        approvedAt: new Date("2026-07-11T00:00:00.000Z"),
      },
    });
  }

  await prisma.branchRule.deleteMany({
    where: { questionVersionId: version.id },
  });

  for (const rule of question.branchRules ?? []) {
    await prisma.branchRule.create({
      data: {
        questionVersionId: version.id,
        targetDefinitionKey: rule.targetDefinitionKey,
        priority: rule.priority ?? 100,
        ruleJson: rule.ruleJson as never,
      },
    });
  }

  await prisma.reviewFlagRule.deleteMany({
    where: { questionVersionId: version.id },
  });

  for (const rule of question.reviewFlagRules ?? []) {
    await prisma.reviewFlagRule.create({
      data: {
        questionVersionId: version.id,
        flagType: rule.flagType,
        ruleJson: rule.ruleJson as never,
      },
    });
  }
}

export async function seedDatabase() {
  const env = getEnv();
  const allowDemoContent = isDemoContentAllowedForEnvironment({
    nodeEnv: env.NODE_ENV,
    allowDemoContent: env.ALLOW_DEMO_CONTENT,
  });
  const organization = await prisma.organization.upsert({
    where: { id: "org_jacklaw_demo" },
    update: {
      name: "JACKLAW Demo",
      defaultTimeZone: env.ORGANIZATION_DEFAULT_TIME_ZONE,
    },
    create: {
      id: "org_jacklaw_demo",
      name: "JACKLAW Demo",
      defaultTimeZone: env.ORGANIZATION_DEFAULT_TIME_ZONE,
    },
  });

  await prisma.rewardDefinition.upsert({
    where: { rewardKey: "neutral_clue" },
    update: {
      nameEs: "Pista de participacion",
      nameEn: "Participation clue",
    },
    create: {
      organizationId: organization.id,
      rewardKey: "neutral_clue",
      nameEs: "Pista de participacion",
      nameEn: "Participation clue",
    },
  });

  for (const reward of HONEY_REWARD_DEFINITIONS) {
    await prisma.rewardDefinition.upsert({
      where: { rewardKey: reward.rewardKey },
      update: {
        nameEs: reward.nameEs,
        nameEn: reward.nameEn,
      },
      create: {
        organizationId: organization.id,
        rewardKey: reward.rewardKey,
        nameEs: reward.nameEs,
        nameEn: reward.nameEn,
      },
    });
  }

  if (!allowDemoContent) {
    return;
  }

  const admin = await prisma.staffUser.upsert({
    where: { email: "admin.fictional@jacklaw.example" },
    update: {
      role: "ADMIN",
      passwordHash: hashPassword(env.DEV_STAFF_PASSWORD),
      displayName: "Alicia Admin",
      allowlisted: true,
    },
    create: {
      organizationId: organization.id,
      email: "admin.fictional@jacklaw.example",
      displayName: "Alicia Admin",
      role: "ADMIN",
      passwordHash: hashPassword(env.DEV_STAFF_PASSWORD),
      allowlisted: true,
    },
  });

  await prisma.staffUser.upsert({
    where: { email: "staff.fictional@jacklaw.example" },
    update: {
      role: "STAFF",
      passwordHash: hashPassword(env.DEV_STAFF_PASSWORD),
      displayName: "Samuel Staff",
      allowlisted: true,
    },
    create: {
      organizationId: organization.id,
      email: "staff.fictional@jacklaw.example",
      displayName: "Samuel Staff",
      role: "STAFF",
      passwordHash: hashPassword(env.DEV_STAFF_PASSWORD),
      allowlisted: true,
    },
  });

  for (const question of questionSeeds) {
    await upsertQuestionVersion(question, organization.id, admin.id);
  }

  const invitationToken = "honey-demo-invite";

  await prisma.invitation.upsert({
    where: {
      tokenHash: hashToken(invitationToken),
    },
    update: {
      organizationId: organization.id,
      phoneE164: "+15555550101",
      locale: "es",
      timeZone: "America/Los_Angeles",
      expiresAt: new Date("2026-08-09T00:00:00.000Z"),
      eligibleForDeletionAt: new Date("2026-08-09T00:00:00.000Z"),
    },
    create: {
      organizationId: organization.id,
      tokenHash: hashToken(invitationToken),
      phoneE164: "+15555550101",
      locale: "es",
      timeZone: "America/Los_Angeles",
      expiresAt: new Date("2026-08-09T00:00:00.000Z"),
      eligibleForDeletionAt: new Date("2026-08-09T00:00:00.000Z"),
    },
  });
}

if (process.argv[1]?.includes("seed")) {
  seedDatabase()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
