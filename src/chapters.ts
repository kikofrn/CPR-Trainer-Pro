export interface Chapter {
  id: string;
  title: string;
  filename: string;
  duration: string;
  subtitle?: string;
  description?: string;
  isSectionHeader?: boolean;
  parentSectionId?: string;
}

export interface Course {
  id: string;
  title: string;
  shortTitle?: string;
  subtitle?: string;
  chapters: Chapter[];
  manualFilename: string;
  isComingSoon?: boolean;
}

export interface Manual {
  id: string;
  title: string;
  filename: string;
}

export interface Slide {
  id: string;
  title: string;
  filename: string;
  type: 'image' | 'video';
  isSectionHeader?: boolean;
  parentSectionId?: string;
}

export interface Slideshow {
  id: string;
  title: string;
  slides: Slide[];
}

export const SLIDESHOWS: Slideshow[] = [
  {
    "id": "cpr-aed-course",
    "title": "CPR & AED for All Ages",
    "slides": [
      {
        "id": "slide-1",
        "title": "Introduction",
        "filename": "/01_EHAcademy - CPR AED Course Pres-Introduction.png",
        "type": "image"
      },
      {
        "id": "slide-2",
        "title": "WHY ARE WE HERE?",
        "filename": "/02_EHAcademy - CPR AED Course Pres-Why should I learn CPR.png",
        "type": "image",
        "isSectionHeader": true
      },
      {
        "id": "slide-3",
        "title": "Heart Attack vs Cardiac Arrest",
        "filename": "/03_EHAcademy - CPR AED Course Pres-Heart Attack vs Cardiac Arrest.png",
        "type": "image",
        "parentSectionId": "slide-2"
      },
      {
        "id": "slide-4",
        "title": "What is CPR",
        "filename": "/04_EHAcademy - CPR AED Course Pres-What is CPR.png",
        "type": "image",
        "parentSectionId": "slide-2"
      },
      {
        "id": "slide-5",
        "title": "When will I use CPR",
        "filename": "/05_EHAcademy - CPR AED Course Pres-When will I use CPR.png",
        "type": "image",
        "parentSectionId": "slide-2"
      },
      {
        "id": "slide-6",
        "title": "What is something goes wrong",
        "filename": "/06_EHAcademy - CPR AED Course Pres-What is something goes wrong.png",
        "type": "image",
        "parentSectionId": "slide-2"
      },
      {
        "id": "slide-7",
        "title": "Good Samaritan Law",
        "filename": "/07_EHAcademy - CPR AED Course Pres-Good Samaritan Law.png",
        "type": "image",
        "parentSectionId": "slide-2"
      },
      {
        "id": "slide-8",
        "title": "Life and Death Drama",
        "filename": "/08_EHAcademy - CPR AED Course Pres-Life and Death Drama.mp4",
        "type": "video"
      },
      {
        "id": "slide-9",
        "title": "Course Overview",
        "filename": "/09_EHAcademy - CPR AED Course Pres-Course Overview.png",
        "type": "image"
      },
      {
        "id": "slide-10",
        "title": "Recognizing the Emergency",
        "filename": "/10_EHAcademy - CPR AED Course Pres-Recognizing the Emergency.png",
        "type": "image"
      },
      {
        "id": "slide-11",
        "title": "First Actions",
        "filename": "/11_EHAcademy - CPR AED Course Pres-First Actions.png",
        "type": "image"
      },
      {
        "id": "slide-12",
        "title": "ASSESSMENT AND ACTIVATION",
        "filename": "/12_EHAcademy - CPR AED Course Pres-Assessment Example.mp4",
        "type": "video",
        "isSectionHeader": true
      },
      {
        "id": "slide-13",
        "title": "Check Responsiveness",
        "filename": "/13_EHAcademy - CPR AED Course Pres-Check Responsiveness.png",
        "type": "image",
        "parentSectionId": "slide-12"
      },
      {
        "id": "slide-14",
        "title": "-Getting Help",
        "filename": "/14_EHAcademy - CPR AED Course Pres--Getting Help.png",
        "type": "image",
        "parentSectionId": "slide-12"
      },
      {
        "id": "slide-15",
        "title": "Check Breathing",
        "filename": "/15_EHAcademy - CPR AED Course Pres-Check Breathing.png",
        "type": "image",
        "parentSectionId": "slide-12"
      },
      {
        "id": "slide-16",
        "title": "Begin Chest Compressions",
        "filename": "/16_EHAcademy - CPR AED Course Pres-Begin Chest Compressions.png",
        "type": "image",
        "parentSectionId": "slide-12"
      },
      {
        "id": "slide-17",
        "title": "CHEST COMPRESSIONS",
        "filename": "/17_EHAcademy - CPR AED Course Pres-Chest Compressions Video.mp4",
        "type": "video",
        "isSectionHeader": true
      },
      {
        "id": "slide-18",
        "title": "Hand Placement",
        "filename": "/18_EHAcademy - CPR AED Course Pres-Hand Placement.png",
        "type": "image",
        "parentSectionId": "slide-17"
      },
      {
        "id": "slide-19",
        "title": "Compression Depth",
        "filename": "/19_EHAcademy - CPR AED Course Pres-Compression Depth.png",
        "type": "image",
        "parentSectionId": "slide-17"
      },
      {
        "id": "slide-20",
        "title": "Rate and Rhythm",
        "filename": "/20_EHAcademy - CPR AED Course Pres-Rate and Rhythm.png",
        "type": "image",
        "parentSectionId": "slide-17"
      },
      {
        "id": "slide-21",
        "title": "CPR Songs",
        "filename": "/21_EHAcademy - CPR AED Course Pres-CPR Songs.mp4",
        "type": "video",
        "parentSectionId": "slide-17"
      },
      {
        "id": "slide-22",
        "title": "Practice Compressions",
        "filename": "/22_EHAcademy - CPR AED Course Pres-Practice Compressions.mp4",
        "type": "video",
        "parentSectionId": "slide-17"
      },
      {
        "id": "slide-23",
        "title": "GIVING BREATHS",
        "filename": "/23_EHAcademy - CPR AED Course Pres-Giving Breaths.png",
        "type": "image",
        "isSectionHeader": true
      },
      {
        "id": "slide-24",
        "title": "Practice Giving Breaths",
        "filename": "/24_EHAcademy - CPR AED Course Pres-Practice Giving Breaths.png",
        "type": "image",
        "parentSectionId": "slide-23"
      },
      {
        "id": "slide-25",
        "title": "Using an AED",
        "filename": "/25_EHAcademy - CPR AED Course Pres-Using an AED.png",
        "type": "image"
      },
      {
        "id": "slide-26",
        "title": "Adult Scenario",
        "filename": "/26_EHAcademy - CPR AED Course Pres-Adult Scenario.png",
        "type": "image"
      },
      {
        "id": "slide-27",
        "title": "Child CPR",
        "filename": "/27_EHAcademy - CPR AED Course Pres-Child CPR.png",
        "type": "image",
        "isSectionHeader": true
      },
      {
        "id": "slide-28",
        "title": "AED use on kids",
        "filename": "/28_EHAcademy - CPR AED Course Pres-AED use on kids.png",
        "type": "image",
        "parentSectionId": "slide-27"
      },
      {
        "id": "slide-29",
        "title": "Help from Others",
        "filename": "/29_EHAcademy - CPR AED Course Pres-Help from Others.png",
        "type": "image"
      },
      {
        "id": "slide-30",
        "title": "Infant CPR",
        "filename": "/30_EHAcademy - CPR AED Course Pres-Infant CPR.png",
        "type": "image",
        "isSectionHeader": true
      },
      {
        "id": "slide-31",
        "title": "Infant Chest Compressions",
        "filename": "/31_EHAcademy - CPR AED Course Pres-Infant Chest Compressions.png",
        "type": "image",
        "parentSectionId": "slide-30"
      },
      {
        "id": "slide-32",
        "title": "Giving Breaths",
        "filename": "/32_EHAcademy - CPR AED Course Pres-Giving Breaths.png",
        "type": "image",
        "parentSectionId": "slide-30"
      },
      {
        "id": "slide-33",
        "title": "Infant Scenario",
        "filename": "/33_EHAcademy - CPR AED Course Pres-Infant Scenario.png",
        "type": "image",
        "parentSectionId": "slide-30"
      },
      {
        "id": "slide-34",
        "title": "CHOKING",
        "filename": "/34_EHAcademy - CPR AED Course Pres-Mild Choking.png",
        "type": "image",
        "isSectionHeader": true
      },
      {
        "id": "slide-35",
        "title": "Severe Choking",
        "filename": "/35_EHAcademy - CPR AED Course Pres-Severe Choking.png",
        "type": "image",
        "parentSectionId": "slide-34"
      },
      {
        "id": "slide-36",
        "title": "Choking  Adult",
        "filename": "/36_EHAcademy - CPR AED Course Pres-Choking  Adult.png",
        "type": "image",
        "parentSectionId": "slide-34"
      },
      {
        "id": "slide-37",
        "title": "Choking Child",
        "filename": "/37_EHAcademy - CPR AED Course Pres-Choking Child.png",
        "type": "image",
        "parentSectionId": "slide-34"
      },
      {
        "id": "slide-38",
        "title": "Choking Infant",
        "filename": "/38_EHAcademy - CPR AED Course Pres-Choking Infant.png",
        "type": "image",
        "parentSectionId": "slide-34"
      },
      {
        "id": "slide-39",
        "title": "Practice Infant Choking",
        "filename": "/39_EHAcademy - CPR AED Course Pres-Practice Infant Choking.png",
        "type": "image",
        "parentSectionId": "slide-34"
      },
      {
        "id": "slide-40",
        "title": "Conclusion",
        "filename": "/40_EHAcademy - CPR AED Course Pres-Conclusion.png",
        "type": "image"
      }
    ]
  },
  {
    "id": "first-aid-course",
    "title": "First Aid for All Ages",
    "slides": [
      {
        "id": "slide-1",
        "title": "Introduction",
        "filename": "/01_EHAcademy - First Aid Course Pres-Introduction.png",
        "type": "image"
      },
      {
        "id": "slide-2",
        "title": "What is First Aid",
        "filename": "/02_EHAcademy - First Aid Course Pres-What is First Aid.png",
        "type": "image"
      },
      {
        "id": "slide-3",
        "title": "First Aid Basics",
        "filename": "/03_EHAcademy - First Aid Course Pres-First Aid Basics.png",
        "type": "image"
      },
      {
        "id": "slide-4",
        "title": "Universal Precautions",
        "filename": "/04_EHAcademy - First Aid Course Pres-Universal Precautions.png",
        "type": "image"
      },
      {
        "id": "slide-5",
        "title": "Legal Concerns",
        "filename": "/05_EHAcademy - First Aid Course Pres-Legal Concerns.png",
        "type": "image"
      },
      {
        "id": "slide-6",
        "title": "Calling 911",
        "filename": "/06_EHAcademy - First Aid Course Pres-Calling 911.png",
        "type": "image"
      },
      {
        "id": "slide-7",
        "title": "MEDICAL EMERGENCIES",
        "filename": "/07_EHAcademy - First Aid Course Pres-Medical Emergencies.png",
        "type": "image",
        "isSectionHeader": true
      },
      {
        "id": "slide-8",
        "title": "Heart Attack Symptoms",
        "filename": "/08_EHAcademy - First Aid Course Pres-Heart Attack Symptoms.png",
        "type": "image",
        "parentSectionId": "slide-7"
      },
      {
        "id": "slide-9",
        "title": "Heart Attack",
        "filename": "/09_EHAcademy - First Aid Course Pres-Heart Attack.png",
        "type": "image",
        "parentSectionId": "slide-7"
      },
      {
        "id": "slide-10",
        "title": "Stroke",
        "filename": "/10_EHAcademy - First Aid Course Pres-Stroke.png",
        "type": "image",
        "parentSectionId": "slide-7"
      },
      {
        "id": "slide-11",
        "title": "Seizure Video",
        "filename": "/11_EHAcademy - First Aid Course Pres-Seizure Video.mp4",
        "type": "video",
        "parentSectionId": "slide-7"
      },
      {
        "id": "slide-12",
        "title": "Seizure",
        "filename": "/12_EHAcademy - First Aid Course Pres-Seizure.png",
        "type": "image",
        "parentSectionId": "slide-7"
      },
      {
        "id": "slide-13",
        "title": "Diabetes",
        "filename": "/13_EHAcademy - First Aid Course Pres-Diabetes.png",
        "type": "image",
        "parentSectionId": "slide-7"
      },
      {
        "id": "slide-14",
        "title": "Difficulty Breathing",
        "filename": "/14_EHAcademy - First Aid Course Pres-Difficulty Breathing.png",
        "type": "image",
        "parentSectionId": "slide-7"
      },
      {
        "id": "slide-15",
        "title": "Allergic Reaction",
        "filename": "/15_EHAcademy - First Aid Course Pres-Allergic Reaction.png",
        "type": "image",
        "parentSectionId": "slide-7"
      },
      {
        "id": "slide-16",
        "title": "Fainting",
        "filename": "/16_EHAcademy - First Aid Course Pres-Fainting.png",
        "type": "image",
        "parentSectionId": "slide-7"
      },
      {
        "id": "slide-17",
        "title": "BLEEDING AND WOUNDS",
        "filename": "/17_EHAcademy - First Aid Course Pres-Bleeding and Wounds.png",
        "type": "image",
        "isSectionHeader": true
      },
      {
        "id": "slide-18",
        "title": "Minor External Bleeding",
        "filename": "/18_EHAcademy - First Aid Course Pres-Minor External Bleeding.png",
        "type": "image",
        "parentSectionId": "slide-17"
      },
      {
        "id": "slide-19",
        "title": "Major External Bleeding",
        "filename": "/19_EHAcademy - First Aid Course Pres-Major External Bleeding.png",
        "type": "image",
        "parentSectionId": "slide-17"
      },
      {
        "id": "slide-20",
        "title": "Using a Tourniquet",
        "filename": "/20_EHAcademy - First Aid Course Pres-Using a Tourniquet.png",
        "type": "image",
        "parentSectionId": "slide-17"
      },
      {
        "id": "slide-21",
        "title": "Nosebleed",
        "filename": "/21_EHAcademy - First Aid Course Pres-Nosebleed.png",
        "type": "image",
        "parentSectionId": "slide-17"
      },
      {
        "id": "slide-22",
        "title": "Mouth Bleed",
        "filename": "/22_EHAcademy - First Aid Course Pres-Mouth Bleed.png",
        "type": "image",
        "parentSectionId": "slide-17"
      },
      {
        "id": "slide-23",
        "title": "Penetration Injuries",
        "filename": "/23_EHAcademy - First Aid Course Pres-Penetration Injuries.png",
        "type": "image",
        "parentSectionId": "slide-17"
      },
      {
        "id": "slide-24",
        "title": "Internal Bleeding",
        "filename": "/24_EHAcademy - First Aid Course Pres-Internal Bleeding.png",
        "type": "image",
        "parentSectionId": "slide-17"
      },
      {
        "id": "slide-25",
        "title": "Amputation",
        "filename": "/25_EHAcademy - First Aid Course Pres-Amputation.png",
        "type": "image",
        "parentSectionId": "slide-17"
      },
      {
        "id": "slide-26",
        "title": "Shock",
        "filename": "/26_EHAcademy - First Aid Course Pres-Shock.png",
        "type": "image",
        "parentSectionId": "slide-17"
      },
      {
        "id": "slide-27",
        "title": "BODILY INJURIES",
        "filename": "/27_EHAcademy - First Aid Course Pres-Bodily Injuries.png",
        "type": "image",
        "isSectionHeader": true
      },
      {
        "id": "slide-28",
        "title": "Eye Injury",
        "filename": "/28_EHAcademy - First Aid Course Pres-Eye Injury.png",
        "type": "image",
        "parentSectionId": "slide-27"
      },
      {
        "id": "slide-29",
        "title": "Sprain and Fracture",
        "filename": "/29_EHAcademy - First Aid Course Pres-Sprain and Fracture.png",
        "type": "image",
        "parentSectionId": "slide-27"
      },
      {
        "id": "slide-30",
        "title": "Head Neck or Spine Injuries",
        "filename": "/30_EHAcademy - First Aid Course Pres-Head Neck or Spine Injuries.png",
        "type": "image",
        "parentSectionId": "slide-27"
      },
      {
        "id": "slide-31",
        "title": "Burns",
        "filename": "/31_EHAcademy - First Aid Course Pres-Burns.png",
        "type": "image",
        "parentSectionId": "slide-27"
      },
      {
        "id": "slide-32",
        "title": "Electrical Burns",
        "filename": "/32_EHAcademy - First Aid Course Pres-Electrical Burns.png",
        "type": "image",
        "parentSectionId": "slide-27"
      },
      {
        "id": "slide-33",
        "title": "ENVIRONMENTAL EMERGENCIES",
        "filename": "/33_EHAcademy - First Aid Course Pres-Environmental Emergencies.png",
        "type": "image",
        "isSectionHeader": true
      },
      {
        "id": "slide-34",
        "title": "Animal or Human Bite",
        "filename": "/34_EHAcademy - First Aid Course Pres-Animal or Human Bite.png",
        "type": "image",
        "parentSectionId": "slide-33"
      },
      {
        "id": "slide-35",
        "title": "Snake Bite",
        "filename": "/35_EHAcademy - First Aid Course Pres-Snake Bite.png",
        "type": "image",
        "parentSectionId": "slide-33"
      },
      {
        "id": "slide-36",
        "title": "Bee Sting",
        "filename": "/36_EHAcademy - First Aid Course Pres-Bee Sting.png",
        "type": "image",
        "parentSectionId": "slide-33"
      },
      {
        "id": "slide-37",
        "title": "Spider or Scorpion Bite",
        "filename": "/37_EHAcademy - First Aid Course Pres-Spider or Scorpion Bite.png",
        "type": "image",
        "parentSectionId": "slide-33"
      },
      {
        "id": "slide-38",
        "title": "Tick Bites",
        "filename": "/38_EHAcademy - First Aid Course Pres-Tick Bites.png",
        "type": "image",
        "parentSectionId": "slide-33"
      },
      {
        "id": "slide-39",
        "title": "Marine Life Stings",
        "filename": "/39_EHAcademy - First Aid Course Pres-Marine Life Stings.png",
        "type": "image",
        "parentSectionId": "slide-33"
      },
      {
        "id": "slide-40",
        "title": "Drowning",
        "filename": "/40_EHAcademy - First Aid Course Pres-Drowning.png",
        "type": "image",
        "parentSectionId": "slide-33"
      },
      {
        "id": "slide-41",
        "title": "Poisoning",
        "filename": "/41_EHAcademy - First Aid Course Pres-Poisoning.png",
        "type": "image",
        "parentSectionId": "slide-33"
      },
      {
        "id": "slide-42",
        "title": "Opioid and Overdose",
        "filename": "/42_EHAcademy - First Aid Course Pres-Opioid and Overdose.png",
        "type": "image",
        "parentSectionId": "slide-33"
      },
      {
        "id": "slide-43",
        "title": "TEMPERATURE RELATE ILLNESS",
        "filename": "/43_EHAcademy - First Aid Course Pres-Temperature Relate Illness.png",
        "type": "image",
        "isSectionHeader": true
      },
      {
        "id": "slide-44",
        "title": "Heat Relate Illness",
        "filename": "/44_EHAcademy - First Aid Course Pres-Heat Relate Illness.png",
        "type": "image",
        "parentSectionId": "slide-43"
      },
      {
        "id": "slide-45",
        "title": "Cold Related Illness",
        "filename": "/45_EHAcademy - First Aid Course Pres-Cold Related Illness.png",
        "type": "image",
        "parentSectionId": "slide-43"
      },
      {
        "id": "slide-46",
        "title": "Conclusion",
        "filename": "/46_EHAcademy - First Aid Course Pres-Conclusion.png",
        "type": "image"
      }
    ]
  },
  {
  "id": "cpr-aed-spanish-course",
  "title": "CPR AED Course - SPANISH EDITION",
  "slides": [
    {
      "id": "slide-1",
      "title": "Introduccion",
      "filename": "/01_EHAcademy - CPR AED Spanish Pres-Introduccion.png",
      "type": "image"
    },
    {
      "id": "slide-2",
      "title": "Por que deberia aprender RCP",
      "filename": "/02_EHAcademy - CPR AED Spanish Pres-Por que deberia aprender RCP.png",
      "type": "image"
    },
    {
      "id": "slide-3",
      "title": "Ataque Cardiaco vs Paro Cardiaco",
      "filename": "/03_EHAcademy - CPR AED Spanish Pres-Ataque Cardiaco vs Paro Cardiaco.png",
      "type": "image"
    },
    {
      "id": "slide-4",
      "title": "Que es la RCP",
      "filename": "/04_EHAcademy - CPR AED Spanish Pres-Que es la RCP.png",
      "type": "image"
    },
    {
      "id": "slide-5",
      "title": "Cuando usare la RCP",
      "filename": "/05_EHAcademy - CPR AED Spanish Pres-Cuando usare la RCP.png",
      "type": "image"
    },
    {
      "id": "slide-6",
      "title": "Que pasa si algo sale mal",
      "filename": "/06_EHAcademy - CPR AED Spanish Pres-Que pasa si algo sale mal.png",
      "type": "image"
    },
    {
      "id": "slide-7",
      "title": "Ley del Buen Samaritano",
      "filename": "/07_EHAcademy - CPR AED Spanish Pres-Ley del Buen Samaritano.png",
      "type": "image"
    },
    {
      "id": "slide-8",
      "title": "Drama de Vida o Muerte",
      "filename": "/08_EHAcademy - CPR AED Spanish Pres-Drama de Vida o Muerte.mp4",
      "type": "video"
    },
    {
      "id": "slide-9",
      "title": "Resumen del Curso",
      "filename": "/09_EHAcademy - CPR AED Spanish Pres-Resumen del Curso.png",
      "type": "image"
    },
    {
      "id": "slide-10",
      "title": "Reconociendo la Emergencia",
      "filename": "/10_EHAcademy - CPR AED Spanish Pres-Reconociendo la Emergencia.png",
      "type": "image"
    },
    {
      "id": "slide-11",
      "title": "Primeras Acciones",
      "filename": "/11_EHAcademy - CPR AED Spanish Pres-Primeras Acciones.png",
      "type": "image"
    },
    {
      "id": "slide-12",
      "title": "Ejemplo de Evaluacion",
      "filename": "/12_EHAcademy - CPR AED Spanish Pres-Ejemplo de Evaluacion.mp4",
      "type": "video"
    },
    {
      "id": "slide-13",
      "title": "Verificar Respuesta",
      "filename": "/13_EHAcademy - CPR AED Spanish Pres-Verificar Respuesta.png",
      "type": "image"
    },
    {
      "id": "slide-14",
      "title": "Pedir Ayuda",
      "filename": "/14_EHAcademy - CPR AED Spanish Pres-Pedir Ayuda.png",
      "type": "image"
    },
    {
      "id": "slide-15",
      "title": "Verificar Respiracion",
      "filename": "/15_EHAcademy - CPR AED Spanish Pres-Verificar Respiracion.png",
      "type": "image"
    },
    {
      "id": "slide-16",
      "title": "Iniciar Compresiones Toracicas",
      "filename": "/16_EHAcademy - CPR AED Spanish Pres-Iniciar Compresiones Toracicas.png",
      "type": "image"
    },
    {
      "id": "slide-17",
      "title": "Video de Compresiones Toracicas",
      "filename": "/17_EHAcademy - CPR AED Spanish Pres-Video de Compresiones Toracicas.mp4",
      "type": "video"
    },
    {
      "id": "slide-18",
      "title": "Posicion de las Manos",
      "filename": "/18_EHAcademy - CPR AED Spanish Pres-Posicion de las Manos.png",
      "type": "image"
    },
    {
      "id": "slide-19",
      "title": "Profundidad de Compresion",
      "filename": "/19_EHAcademy - CPR AED Spanish Pres-Profundidad de Compresion.png",
      "type": "image"
    },
    {
      "id": "slide-20",
      "title": "Ritmo y Frecuencia",
      "filename": "/20_EHAcademy - CPR AED Spanish Pres-Ritmo y Frecuencia.png",
      "type": "image"
    },
    {
      "id": "slide-21",
      "title": "Canciones de RCP",
      "filename": "/21_EHAcademy - CPR AED Spanish Pres-Canciones de RCP.mp4",
      "type": "video"
    },
    {
      "id": "slide-22",
      "title": "Practicar Compresiones",
      "filename": "/22_EHAcademy - CPR AED Spanish Pres-Practicar Compresiones.mp4",
      "type": "video"
    },
    {
      "id": "slide-23",
      "title": "Dar Respiraciones",
      "filename": "/23_EHAcademy - CPR AED Spanish Pres-Dar Respiraciones.png",
      "type": "image"
    },
    {
      "id": "slide-24",
      "title": "Practicar Respiraciones",
      "filename": "/24_EHAcademy - CPR AED Spanish Pres-Practicar Respiraciones.png",
      "type": "image"
    },
    {
      "id": "slide-25",
      "title": "Uso del DEA",
      "filename": "/25_EHAcademy - CPR AED Spanish Pres-Uso del DEA.png",
      "type": "image"
    },
    {
      "id": "slide-26",
      "title": "Escenario de Adulto",
      "filename": "/26_EHAcademy - CPR AED Spanish Pres-Escenario de Adulto.png",
      "type": "image"
    },
    {
      "id": "slide-27",
      "title": "RCP en Ninos",
      "filename": "/27_EHAcademy - CPR AED Spanish Pres-RCP en Ninos.png",
      "type": "image"
    },
    {
      "id": "slide-28",
      "title": "Uso del DEA en Ninos",
      "filename": "/28_EHAcademy - CPR AED Spanish Pres-Uso del DEA en Ninos.png",
      "type": "image"
    },
    {
      "id": "slide-29",
      "title": "Ayuda de Otros",
      "filename": "/29_EHAcademy - CPR AED Spanish Pres-Ayuda de Otros.png",
      "type": "image"
    },
    {
      "id": "slide-30",
      "title": "RCP en Bebes",
      "filename": "/30_EHAcademy - CPR AED Spanish Pres-RCP en Bebes.png",
      "type": "image"
    },
    {
      "id": "slide-31",
      "title": "Compresiones Toracicas en Bebes",
      "filename": "/31_EHAcademy - CPR AED Spanish Pres-Compresiones Toracicas en Bebes.png",
      "type": "image"
    },
    {
      "id": "slide-32",
      "title": "Dar Respiraciones",
      "filename": "/32_EHAcademy - CPR AED Spanish Pres-Dar Respiraciones.png",
      "type": "image"
    },
    {
      "id": "slide-33",
      "title": "Escenario de Bebe",
      "filename": "/33_EHAcademy - CPR AED Spanish Pres-Escenario de Bebe.png",
      "type": "image"
    },
    {
      "id": "slide-34",
      "title": "Atragantamiento Leve",
      "filename": "/34_EHAcademy - CPR AED Spanish Pres-Atragantamiento Leve.png",
      "type": "image"
    },
    {
      "id": "slide-35",
      "title": "Atragantamiento Severo",
      "filename": "/35_EHAcademy - CPR AED Spanish Pres-Atragantamiento Severo.png",
      "type": "image"
    },
    {
      "id": "slide-36",
      "title": "Atragantamiento en Adulto",
      "filename": "/36_EHAcademy - CPR AED Spanish Pres-Atragantamiento en Adulto.png",
      "type": "image"
    },
    {
      "id": "slide-37",
      "title": "Atragantamiento en Nino",
      "filename": "/37_EHAcademy - CPR AED Spanish Pres-Atragantamiento en Nino.png",
      "type": "image"
    },
    {
      "id": "slide-38",
      "title": "Atragantamiento en Bebe",
      "filename": "/38_EHAcademy - CPR AED Spanish Pres-Atragantamiento en Bebe.png",
      "type": "image"
    },
    {
      "id": "slide-39",
      "title": "Practicar Atragantamiento en Bebe",
      "filename": "/39_EHAcademy - CPR AED Spanish Pres-Practicar Atragantamiento en Bebe.png",
      "type": "image"
    },
    {
      "id": "slide-40",
      "title": "Conclusion",
      "filename": "/40_EHAcademy - CPR AED Spanish Pres-Conclusion.png",
      "type": "image"
    }
  ]
},
  {
  "id": "first-aid-spanish-course",
  "title": "FIRST AID Course - SPANISH EDITION",
  "slides": [
    {
      "id": "slide-1",
      "title": "Introduccion",
      "filename": "/01_EHAcademy - First Aid Spanish Pres-Introduccion.png",
      "type": "image"
    },
    {
      "id": "slide-2",
      "title": "Que son los Primeros Auxilios",
      "filename": "/02_EHAcademy - First Aid Spanish Pres-Que son los Primeros Auxilios.png",
      "type": "image"
    },
    {
      "id": "slide-3",
      "title": "Conceptos Basicos de Primeros Auxilios",
      "filename": "/03_EHAcademy - First Aid Spanish Pres-Conceptos Basicos de Primeros Auxilios.png",
      "type": "image"
    },
    {
      "id": "slide-4",
      "title": "Precauciones Universales",
      "filename": "/04_EHAcademy - First Aid Spanish Pres-Precauciones Universales.png",
      "type": "image"
    },
    {
      "id": "slide-5",
      "title": "Consideraciones Legales",
      "filename": "/05_EHAcademy - First Aid Spanish Pres-Consideraciones Legales.png",
      "type": "image"
    },
    {
      "id": "slide-6",
      "title": "Llamar al 911",
      "filename": "/06_EHAcademy - First Aid Spanish Pres-Llamar al 911.png",
      "type": "image"
    },
    {
      "id": "slide-7",
      "title": "Emergencias Medicas",
      "filename": "/07_EHAcademy - First Aid Spanish Pres-Emergencias Medicas.png",
      "type": "image"
    },
    {
      "id": "slide-8",
      "title": "Sintomas de Ataque Cardiaco",
      "filename": "/08_EHAcademy - First Aid Spanish Pres-Sintomas de Ataque Cardiaco.png",
      "type": "image"
    },
    {
      "id": "slide-9",
      "title": "Ataque Cardiaco",
      "filename": "/09_EHAcademy - First Aid Spanish Pres-Ataque Cardiaco.png",
      "type": "image"
    },
    {
      "id": "slide-10",
      "title": "Derrame Cerebral",
      "filename": "/10_EHAcademy - First Aid Spanish Pres-Derrame Cerebral.png",
      "type": "image"
    },
    {
      "id": "slide-11",
      "title": "Video de Convulsiones",
      "filename": "/11_EHAcademy - First Aid Spanish Pres-Video de Convulsiones.mp4",
      "type": "video"
    },
    {
      "id": "slide-12",
      "title": "Convulsiones",
      "filename": "/12_EHAcademy - First Aid Spanish Pres-Convulsiones.png",
      "type": "image"
    },
    {
      "id": "slide-13",
      "title": "Diabetes",
      "filename": "/13_EHAcademy - First Aid Spanish Pres-Diabetes.png",
      "type": "image"
    },
    {
      "id": "slide-14",
      "title": "Dificultad para Respirar",
      "filename": "/14_EHAcademy - First Aid Spanish Pres-Dificultad para Respirar.png",
      "type": "image"
    },
    {
      "id": "slide-15",
      "title": "Reaccion Alergica",
      "filename": "/15_EHAcademy - First Aid Spanish Pres-Reaccion Alergica.png",
      "type": "image"
    },
    {
      "id": "slide-16",
      "title": "Desmayo",
      "filename": "/16_EHAcademy - First Aid Spanish Pres-Desmayo.png",
      "type": "image"
    },
    {
      "id": "slide-17",
      "title": "Sangrado y Heridas",
      "filename": "/17_EHAcademy - First Aid Spanish Pres-Sangrado y Heridas.png",
      "type": "image"
    },
    {
      "id": "slide-18",
      "title": "Sangrado Externo Menor",
      "filename": "/18_EHAcademy - First Aid Spanish Pres-Sangrado Externo Menor.png",
      "type": "image"
    },
    {
      "id": "slide-19",
      "title": "Sangrado Externo Mayor",
      "filename": "/19_EHAcademy - First Aid Spanish Pres-Sangrado Externo Mayor.png",
      "type": "image"
    },
    {
      "id": "slide-20",
      "title": "Uso de un Torniquete",
      "filename": "/20_EHAcademy - First Aid Spanish Pres-Uso de un Torniquete.png",
      "type": "image"
    },
    {
      "id": "slide-21",
      "title": "Sangrado Nasal",
      "filename": "/21_EHAcademy - First Aid Spanish Pres-Sangrado Nasal.png",
      "type": "image"
    },
    {
      "id": "slide-22",
      "title": "Sangrado Bucal",
      "filename": "/22_EHAcademy - First Aid Spanish Pres-Sangrado Bucal.png",
      "type": "image"
    },
    {
      "id": "slide-23",
      "title": "Lesiones por Penetracion",
      "filename": "/23_EHAcademy - First Aid Spanish Pres-Lesiones por Penetracion.png",
      "type": "image"
    },
    {
      "id": "slide-24",
      "title": "Sangrado Interno",
      "filename": "/24_EHAcademy - First Aid Spanish Pres-Sangrado Interno.png",
      "type": "image"
    },
    {
      "id": "slide-25",
      "title": "Amputacion",
      "filename": "/25_EHAcademy - First Aid Spanish Pres-Amputacion.png",
      "type": "image"
    },
    {
      "id": "slide-26",
      "title": "Shock",
      "filename": "/26_EHAcademy - First Aid Spanish Pres-Shock.png",
      "type": "image"
    },
    {
      "id": "slide-27",
      "title": "Lesiones Corporales",
      "filename": "/27_EHAcademy - First Aid Spanish Pres-Lesiones Corporales.png",
      "type": "image"
    },
    {
      "id": "slide-28",
      "title": "Lesion Ocular",
      "filename": "/28_EHAcademy - First Aid Spanish Pres-Lesion Ocular.png",
      "type": "image"
    },
    {
      "id": "slide-29",
      "title": "Esguince y Fractura",
      "filename": "/29_EHAcademy - First Aid Spanish Pres-Esguince y Fractura.png",
      "type": "image"
    },
    {
      "id": "slide-30",
      "title": "Lesiones de Cabeza o Columna",
      "filename": "/30_EHAcademy - First Aid Spanish Pres-Lesiones de Cabeza o Columna.png",
      "type": "image"
    },
    {
      "id": "slide-31",
      "title": "Quemaduras",
      "filename": "/31_EHAcademy - First Aid Spanish Pres-Quemaduras.png",
      "type": "image"
    },
    {
      "id": "slide-32",
      "title": "Quemaduras Electricas",
      "filename": "/32_EHAcademy - First Aid Spanish Pres-Quemaduras Electricas.png",
      "type": "image"
    },
    {
      "id": "slide-33",
      "title": "Emergencias Ambientales",
      "filename": "/33_EHAcademy - First Aid Spanish Pres-Emergencias Ambientales.png",
      "type": "image"
    },
    {
      "id": "slide-34",
      "title": "Mordedura Animal o Humana",
      "filename": "/34_EHAcademy - First Aid Spanish Pres-Mordedura Animal o Humana.png",
      "type": "image"
    },
    {
      "id": "slide-35",
      "title": "Mordedura de Serpiente",
      "filename": "/35_EHAcademy - First Aid Spanish Pres-Mordedura de Serpiente.png",
      "type": "image"
    },
    {
      "id": "slide-36",
      "title": "Picadura de Abeja",
      "filename": "/36_EHAcademy - First Aid Spanish Pres-Picadura de Abeja.png",
      "type": "image"
    },
    {
      "id": "slide-37",
      "title": "Mordedura de Arana o Escorpion",
      "filename": "/37_EHAcademy - First Aid Spanish Pres-Mordedura de Arana o Escorpion.png",
      "type": "image"
    },
    {
      "id": "slide-38",
      "title": "Picaduras de Garrapata",
      "filename": "/38_EHAcademy - First Aid Spanish Pres-Picaduras de Garrapata.png",
      "type": "image"
    },
    {
      "id": "slide-39",
      "title": "Picaduras de Vida Marina",
      "filename": "/39_EHAcademy - First Aid Spanish Pres-Picaduras de Vida Marina.png",
      "type": "image"
    },
    {
      "id": "slide-40",
      "title": "Ahogamiento",
      "filename": "/40_EHAcademy - First Aid Spanish Pres-Ahogamiento.png",
      "type": "image"
    },
    {
      "id": "slide-41",
      "title": "Envenenamiento",
      "filename": "/41_EHAcademy - First Aid Spanish Pres-Envenenamiento.png",
      "type": "image"
    },
    {
      "id": "slide-42",
      "title": "Opioides y Sobredosis",
      "filename": "/42_EHAcademy - First Aid Spanish Pres-Opioides y Sobredosis.png",
      "type": "image"
    },
    {
      "id": "slide-43",
      "title": "Enfermedades Relacionadas con la Temperatura",
      "filename": "/43_EHAcademy - First Aid Spanish Pres-Enfermedades Relacionadas con la Temperatura.png",
      "type": "image"
    },
    {
      "id": "slide-44",
      "title": "Enfermedades Relacionadas con el Calor",
      "filename": "/44_EHAcademy - First Aid Spanish Pres-Enfermedades Relacionadas con el Calor.png",
      "type": "image"
    },
    {
      "id": "slide-45",
      "title": "Enfermedades Relacionadas con el Frio",
      "filename": "/45_EHAcademy - First Aid Spanish Pres-Enfermedades Relacionadas con el Frio.png",
      "type": "image"
    },
    {
      "id": "slide-46",
      "title": "Conclusion",
      "filename": "/46_EHAcademy - First Aid Spanish Pres-Conclusion.png",
      "type": "image"
    }
  ]
},
  {
  "id": "pediatric-first-aid-course",
  "title": "Pediatric First Aid",
  "slides": [
    {
      "id": "slide-1",
      "title": "Introduction",
      "filename": "/01_EHAcademy - Pedi FA Course Pres-Introduction.png",
      "type": "image"
    },
    {
      "id": "slide-2",
      "title": "What is First Aid",
      "filename": "/02_EHAcademy - Pedi FA Course Pres-What is First Aid.png",
      "type": "image"
    },
    {
      "id": "slide-3",
      "title": "First Aid Basics",
      "filename": "/03_EHAcademy - Pedi FA Course Pres-First Aid Basics.png",
      "type": "image"
    },
    {
      "id": "slide-4",
      "title": "Universal Precautions",
      "filename": "/04_EHAcademy - Pedi FA Course Pres-Universal Precautions.png",
      "type": "image"
    },
    {
      "id": "slide-5",
      "title": "Legal Concerns",
      "filename": "/05_EHAcademy - Pedi FA Course Pres-Legal Concerns.png",
      "type": "image"
    },
    {
      "id": "slide-6",
      "title": "Calling 911",
      "filename": "/06_EHAcademy - Pedi FA Course Pres-Calling 911.png",
      "type": "image"
    },
    {
      "id": "slide-7",
      "title": "MEDICAL EMERGENCIES",
      "filename": "/07_EHAcademy - Pedi FA Course Pres- MEDICAL EMERGENCIES.png",
      "type": "image"
    },
    {
      "id": "slide-8",
      "title": "Heart Attack Symptoms",
      "filename": "/08_EHAcademy - Pedi FA Course Pres-Heart Attack Symptoms.png",
      "type": "image"
    },
    {
      "id": "slide-9",
      "title": "Heart Attack",
      "filename": "/09_EHAcademy - Pedi FA Course Pres-Heart Attack.png",
      "type": "image"
    },
    {
      "id": "slide-10",
      "title": "Stroke",
      "filename": "/10_EHAcademy - Pedi FA Course Pres-Stroke.png",
      "type": "image"
    },
    {
      "id": "slide-11",
      "title": "Seizure Video",
      "filename": "/11_EHAcademy - Pedi FA Course Pres-Seizure Video.mp4",
      "type": "video"
    },
    {
      "id": "slide-12",
      "title": "Seizures",
      "filename": "/12_EHAcademy - Pedi FA Course Pres-Seizures.png",
      "type": "image"
    },
    {
      "id": "slide-13",
      "title": "Diabetes",
      "filename": "/13_EHAcademy - Pedi FA Course Pres-Diabetes.png",
      "type": "image"
    },
    {
      "id": "slide-14",
      "title": "Asthma",
      "filename": "/14_EHAcademy - Pedi FA Course Pres-Asthma.png",
      "type": "image"
    },
    {
      "id": "slide-15",
      "title": "Difficulty Breathing",
      "filename": "/15_EHAcademy - Pedi FA Course Pres-Difficulty Breathing.png",
      "type": "image"
    },
    {
      "id": "slide-16",
      "title": "Allergic Reaction",
      "filename": "/16_EHAcademy - Pedi FA Course Pres-Allergic Reaction.png",
      "type": "image"
    },
    {
      "id": "slide-17",
      "title": "Fainting",
      "filename": "/17_EHAcademy - Pedi FA Course Pres-Fainting.png",
      "type": "image"
    },
    {
      "id": "slide-18",
      "title": "BLEEDING & WOUNDS",
      "filename": "/18_EHAcademy - Pedi FA Course Pres-BLEEDING & WOUNDS.png",
      "type": "image"
    },
    {
      "id": "slide-19",
      "title": "Minor External Bleeding",
      "filename": "/19_EHAcademy - Pedi FA Course Pres-Minor External Bleeding.png",
      "type": "image"
    },
    {
      "id": "slide-20",
      "title": "Major External Bleeding",
      "filename": "/20_EHAcademy - Pedi FA Course Pres-Major External Bleeding.png",
      "type": "image"
    },
    {
      "id": "slide-21",
      "title": "Using a Tourniquet",
      "filename": "/21_EHAcademy - Pedi FA Course Pres-Using a Tourniquet.png",
      "type": "image"
    },
    {
      "id": "slide-22",
      "title": "Nose Bleed",
      "filename": "/22_EHAcademy - Pedi FA Course Pres-Nose Bleed.png",
      "type": "image"
    },
    {
      "id": "slide-23",
      "title": "Mouth Bleed",
      "filename": "/23_EHAcademy - Pedi FA Course Pres-Mouth Bleed.png",
      "type": "image"
    },
    {
      "id": "slide-24",
      "title": "Penetration Injuries",
      "filename": "/24_EHAcademy - Pedi FA Course Pres-Penetration Injuries.png",
      "type": "image"
    },
    {
      "id": "slide-25",
      "title": "Internal Bleeding",
      "filename": "/25_EHAcademy - Pedi FA Course Pres-Internal Bleeding.png",
      "type": "image"
    },
    {
      "id": "slide-26",
      "title": "Amputation",
      "filename": "/26_EHAcademy - Pedi FA Course Pres-Amputation.png",
      "type": "image"
    },
    {
      "id": "slide-27",
      "title": "Shock",
      "filename": "/27_EHAcademy - Pedi FA Course Pres-Shock.png",
      "type": "image"
    },
    {
      "id": "slide-28",
      "title": "BODILY INJURIES",
      "filename": "/28_EHAcademy - Pedi FA Course Pres-BODILY INJURIES.png",
      "type": "image"
    },
    {
      "id": "slide-29",
      "title": "Eye Injury",
      "filename": "/29_EHAcademy - Pedi FA Course Pres-Eye Injury.png",
      "type": "image"
    },
    {
      "id": "slide-30",
      "title": "Sprain or Fracture",
      "filename": "/30_EHAcademy - Pedi FA Course Pres-Sprain or Fracture.png",
      "type": "image"
    },
    {
      "id": "slide-31",
      "title": "Head or Spine Injuries",
      "filename": "/31_EHAcademy - Pedi FA Course Pres-Head or Spine Injuries.png",
      "type": "image"
    },
    {
      "id": "slide-32",
      "title": "Burns",
      "filename": "/32_EHAcademy - Pedi FA Course Pres-Burns.png",
      "type": "image"
    },
    {
      "id": "slide-33",
      "title": "Electrical Burns",
      "filename": "/33_EHAcademy - Pedi FA Course Pres-Electrical Burns.png",
      "type": "image"
    },
    {
      "id": "slide-34",
      "title": "ENVIRONMENTAL EMERGENCIES",
      "filename": "/34_EHAcademy - Pedi FA Course Pres-ENVIRONMENTAL EMERGENCIES.png",
      "type": "image"
    },
    {
      "id": "slide-35",
      "title": "Animal or Human Bite",
      "filename": "/35_EHAcademy - Pedi FA Course Pres-Animal or Human Bite.png",
      "type": "image"
    },
    {
      "id": "slide-36",
      "title": "Snake Bite",
      "filename": "/36_EHAcademy - Pedi FA Course Pres-Snake Bite.png",
      "type": "image"
    },
    {
      "id": "slide-37",
      "title": "Bee Sting",
      "filename": "/37_EHAcademy - Pedi FA Course Pres-Bee Sting.png",
      "type": "image"
    },
    {
      "id": "slide-38",
      "title": "Spider or Scorpion Bite",
      "filename": "/38_EHAcademy - Pedi FA Course Pres-Spider or Scorpion Bite.png",
      "type": "image"
    },
    {
      "id": "slide-39",
      "title": "Tick Bite",
      "filename": "/39_EHAcademy - Pedi FA Course Pres-Tick Bite.png",
      "type": "image"
    },
    {
      "id": "slide-40",
      "title": "Marine Bites and Stings",
      "filename": "/40_EHAcademy - Pedi FA Course Pres-Marine Bites and Stings.png",
      "type": "image"
    },
    {
      "id": "slide-41",
      "title": "Drowning",
      "filename": "/41_EHAcademy - Pedi FA Course Pres-Drowning.png",
      "type": "image"
    },
    {
      "id": "slide-42",
      "title": "Poisoning",
      "filename": "/42_EHAcademy - Pedi FA Course Pres-Poisoning.png",
      "type": "image"
    },
    {
      "id": "slide-43",
      "title": "Opioids and Overdose",
      "filename": "/43_EHAcademy - Pedi FA Course Pres-Opioids and Overdose.png",
      "type": "image"
    },
    {
      "id": "slide-44",
      "title": "TEMPERATURE RELATED ILLNESS",
      "filename": "/44_EHAcademy - Pedi FA Course Pres-TEMPERATURE RELATED ILLNESS.png",
      "type": "image"
    },
    {
      "id": "slide-45",
      "title": "Heat Related Illness",
      "filename": "/45_EHAcademy - Pedi FA Course Pres-Heat Related Illness.png",
      "type": "image"
    },
    {
      "id": "slide-46",
      "title": "Cold Related Illness",
      "filename": "/46_EHAcademy - Pedi FA Course Pres-Cold Related Illness.png",
      "type": "image"
    },
    {
      "id": "slide-47",
      "title": "Conclusion",
      "filename": "/47_EHAcademy - Pedi FA Course Pres-Conclusion.png",
      "type": "image"
    }
  ]
}
];

export const MANUALS: Manual[] = [
  {
    id: "instructor",
    title: "EHA Instructor Manual",
    filename: "instructor_manual.pdf"
  },
  {
    id: "student",
    title: "EHA Student Manual",
    filename: "student_manual.pdf"
  },
  {
    id: "pediatric",
    title: "EHA Pediatric Student Manual",
    filename: "pediatric_student_manual.pdf"
  }
];

export const COURSES: Course[] = [
  {
    id: "cpr-aed",
    title: "CPR & AED for All Ages",
    shortTitle: "CPR & AED",
    manualFilename: "instructor_manual.pdf",
    chapters: [
      { id: "cpr-1", title: "Introduction", filename: "01_EHAcademy - CPR AED Course Video-Introduction.mp4", duration: "0:44" },
      { id: "cpr-2", title: "Why are we here", filename: "02_EHAcademy - CPR AED Course Video-Why are we here.mp4", duration: "7:20" },
      { id: "cpr-3", title: "Life and Death Drama", filename: "03_EHAcademy - CPR AED Course Video-Life and Death Drama.mp4", duration: "1:00" },
      { id: "cpr-4", title: "Course Overview", filename: "04_EHAcademy - CPR AED Course Video-Course Overview.mp4", duration: "2:11" },
      { id: "cpr-5", title: "Recognizing the Emergency", filename: "05__EHAcademy - CPR AED Course Video-Recognizing the Emergency.mp4", duration: "1:00" },
      { id: "cpr-6", title: "First Actions", filename: "06_EHAcademy - CPR AED Course Video-First Actions.mp4", duration: "1:13" },
      { id: "cpr-7", title: "Assessment Example", filename: "07_EHAcademy - CPR AED Course Video-Assessment Example.mp4", duration: "1:04" },
      { id: "cpr-8", title: "Assessment and Activation", filename: "08_EHAcademy - CPR AED Course Video-Assessment and Activation.mp4", duration: "4:10" },
      { id: "cpr-9", title: "Chest Compressions Video", filename: "09_EHAcademy - CPR AED Course Video-Chest Compressions Video.mp4", duration: "0:44" },
      { id: "cpr-10", title: "Hand Placement", filename: "10_EHAcademy - CPR AED Course Video-Hand Placement.mp4", duration: "1:20" },
      { id: "cpr-11", title: "Compression Depth", filename: "11_EHAcademy - CPR AED Course Video-Compression Depth.mp4", duration: "0:38" },
      { id: "cpr-12", title: "Rate and Rhythm", filename: "12_EHAcademy - CPR AED Course Video-Rate and Rhythm.mp4", duration: "1:23" },
      { id: "cpr-13", title: "CPR Music", filename: "13_EHAcademy - CPR AED Course Video-CPR Music.mp4", duration: "0:23" },
      { id: "cpr-14", title: "Practice Compressions", filename: "14_EHAcademy - CPR AED Course Video-Practice Compressions.mp4", duration: "1:16" },
      { id: "cpr-15", title: "Giving Breaths", filename: "15_EHAcademy - CPR AED Course Video-Giving Breaths.mp4", duration: "1:36" },
      { id: "cpr-16", title: "Practice Breaths", filename: "16_EHAcademy - CPR AED Course Video-Practice Breaths.mp4", duration: "0:44" },
      { id: "cpr-17", title: "Using an AED", filename: "17_EHAcademy - CPR AED Course Video-Using an AED.mp4", duration: "1:52" },
      { id: "cpr-18", title: "Adult Scenario", filename: "18_EHAcademy - CPR AED Course Video-Adult Scenario.mp4", duration: "1:02" },
      { id: "cpr-19", title: "Child CPR", filename: "19_EHAcademy - CPR AED Course Video-Child CPR.mp4", duration: "2:05" },
      { id: "cpr-20", title: "AED use on kids", filename: "20_EHAcademy - CPR AED Course Video-AED use on kids.mp4", duration: "1:32" },
      { id: "cpr-21", title: "Help from Others", filename: "21_EHAcademy - CPR AED Course Video-Help from Others.mp4", duration: "0:57" },
      { id: "cpr-22", title: "Infant CPR", filename: "22_EHAcademy - CPR AED Course Video-Infant CPR.mp4", duration: "1:30" },
      { id: "cpr-23", title: "Infant Compressions", filename: "23_EHAcademy - CPR AED Course Video-Infant Compressions.mp4", duration: "0:50" },
      { id: "cpr-24", title: "Infant Breaths", filename: "24_EHAcademy - CPR AED Course Video-Infant Breaths.mp4", duration: "1:11" },
      { id: "cpr-25", title: "Infant Scenario", filename: "25_EHAcademy - CPR AED Course Video-Infant Scenario.mp4", duration: "0:30" },
      { id: "cpr-26", title: "Mild Choking", filename: "26_EHAcademy - CPR AED Course Video-Mild Choking.mp4", duration: "0:40" },
      { id: "cpr-27", title: "Severe Choking", filename: "27_EHAcademy - CPR AED Course Video-Severe Choking.mp4", duration: "0:36" },
      { id: "cpr-28", title: "Adult Choking Relief", filename: "28_EHAcademy - CPR AED Course Video-Adult Choking Relief.mp4", duration: "1:11" },
      { id: "cpr-29", title: "Child Choking Relief", filename: "29_EHAcademy - CPR AED Course Video-Child Choking Relief.mp4", duration: "0:51" },
      { id: "cpr-30", title: "Infant Choking Relief", filename: "30_EHAcademy - CPR AED Course Video-Infant Choking Relief.mp4", duration: "2:35" },
      { id: "cpr-31", title: "Conclusion", filename: "31_EHAcademy - CPR AED Course Video-Conclusion.mp4.mp4", duration: "0:46" }
    ]
  },
  {
    id: "first-aid",
    title: "First Aid for All Ages",
    shortTitle: "First Aid",
    manualFilename: "instructor_manual.pdf",
    chapters: [
      { id: "fa-1", title: "Introduction", filename: "01_EHAcademy - First Aid Course-Introduction.mp4", duration: "0:55" },
      { id: "fa-2", title: "What is First Aid", filename: "02_EHAcademy - First Aid Course-What is First Aid.mp4", duration: "1:04" },
      { id: "fa-3", title: "First Aid Basics", filename: "03_EHAcademy - First Aid Course-First Aid Basics.mp4", duration: "1:29" },
      { id: "fa-4", title: "Universal Precautions", filename: "04_EHAcademy - First Aid Course-Universal Precautions.mp4", duration: "1:10" },
      { id: "fa-5", title: "Legal Concerns", filename: "05_EHAcademy - First Aid Course-Legal Concerns.mp4", duration: "0:56" },
      { id: "fa-6", title: "Calling 911", filename: "06_EHAcademy - First Aid Course-Calling 911.mp4", duration: "1:01" },
      { id: "fa-7", title: "MEDICAL EMERGENCIES", filename: "07_EHAcademy - First Aid Course-MEDICAL EMERGENCIES.mp4", duration: "0:17", isSectionHeader: true },
      { id: "fa-8", title: "Heart Attack", filename: "08_EHAcademy - First Aid Course-Heart Attack.mp4", duration: "2:16", parentSectionId: "fa-7" },
      { id: "fa-9", title: "Stroke", filename: "09_EHAcademy - First Aid Course-Stroke.mp4", duration: "1:34", parentSectionId: "fa-7" },
      { id: "fa-10", title: "Seizure Example", filename: "10_EHAcademy - First Aid Course-Seizure Example.mp4", duration: "2:14", parentSectionId: "fa-7" },
      { id: "fa-11", title: "Diabetes", filename: "11_EHAcademy - First Aid Course-Diabetes.mp4", duration: "1:29", parentSectionId: "fa-7" },
      { id: "fa-12", title: "Difficulty Breathing", filename: "12_EHAcademy - First Aid Course-Difficulty Breathing.mp4", duration: "0:51", parentSectionId: "fa-7" },
      { id: "fa-13", title: "Allergic Reaction", filename: "13_EHAcademy - First Aid Course-Allergic Reaction.mp4", duration: "0:55", parentSectionId: "fa-7" },
      { id: "fa-14", title: "Fainting", filename: "14_EHAcademy - First Aid Course-Fainting.mp4", duration: "1:01", parentSectionId: "fa-7" },
      { id: "fa-15", title: "BLEEDING AND WOUNDS", filename: "15_EHAcademy - First Aid Course-BLEEDING AND WOUNDS.mp4", duration: "0:43", isSectionHeader: true },
      { id: "fa-16", title: "Minor Bleeding", filename: "16_EHAcademy - First Aid Course-Minor Bleeding.mp4", duration: "1:12", parentSectionId: "fa-15" },
      { id: "fa-17", title: "Major Bleeding", filename: "17_EHAcademy - First Aid Course-Major Bleeding.mp4", duration: "1:32", parentSectionId: "fa-15" },
      { id: "fa-18", title: "Using a Tourniquet", filename: "18_EHAcademy - First Aid Course-Using a Tourniquet.mp4", duration: "2:00", parentSectionId: "fa-15" },
      { id: "fa-19", title: "Nose Bleed", filename: "19_EHAcademy - First Aid Course-Nose Bleed.mp4", duration: "0:55", parentSectionId: "fa-15" },
      { id: "fa-20", title: "Mouth Bleed", filename: "20_EHAcademy - First Aid Course-Mouth Bleed.mp4", duration: "1:17", parentSectionId: "fa-15" },
      { id: "fa-21", title: "Penetration Injuries", filename: "21_EHAcademy - First Aid Course-Penetration Injuries.mp4", duration: "1:17", parentSectionId: "fa-15" },
      { id: "fa-22", title: "Internal Bleeding", filename: "22_EHAcademy - First Aid Course-Internal Bleeding.mp4", duration: "1:13", parentSectionId: "fa-15" },
      { id: "fa-23", title: "Amputation", filename: "23_EHAcademy - First Aid Course-Amputation.mp4", duration: "1:15", parentSectionId: "fa-15" },
      { id: "fa-24", title: "Shock", filename: "24_EHAcademy - First Aid Course-Shock.mp4", duration: "1:23", parentSectionId: "fa-15" },
      { id: "fa-25", title: "BODILY INJURIES", filename: "25_EHAcademy - First Aid Course-BODILY INJURIES.mp4", duration: "0:24", isSectionHeader: true },
      { id: "fa-26", title: "Eye Injury", filename: "26_EHAcademy - First Aid Course-Eye Injury.mp4", duration: "1:38", parentSectionId: "fa-25" },
      { id: "fa-27", title: "Sprain or Fracture", filename: "27_EHAcademy - First Aid Course-Sprain or Fracture.mp4", duration: "1:33", parentSectionId: "fa-25" },
      { id: "fa-28", title: "Head Neck or Spine Injury", filename: "28_EHAcademy - First Aid Course-Head Neck or Spine Injury.mp4", duration: "1:30", parentSectionId: "fa-25" },
      { id: "fa-29", title: "Burns", filename: "29_EHAcademy - First Aid Course-Burns.mp4", duration: "1:47", parentSectionId: "fa-25" },
      { id: "fa-30", title: "Electrical Burns", filename: "30_EHAcademy - First Aid Course-Electrical Burns.mp4", duration: "1:05", parentSectionId: "fa-25" },
      { id: "fa-31", title: "ENVIRONMENTAL EMERGENCIES", filename: "31_EHAcademy - First Aid Course-ENVIRONMENTAL EMERGENCIES.mp4", duration: "0:23", isSectionHeader: true },
      { id: "fa-32", title: "Animal or Human Bite", filename: "32_EHAcademy - First Aid Course-Animal or Human Bite.mp4", duration: "0:57", parentSectionId: "fa-31" },
      { id: "fa-33", title: "Snake Bite", filename: "33_EHAcademy - First Aid Course-Snake Bite.mp4", duration: "1:09", parentSectionId: "fa-31" },
      { id: "fa-34", title: "Bee Sting", filename: "34_EHAcademy - First Aid Course-Bee Sting.mp4", duration: "0:39", parentSectionId: "fa-31" },
      { id: "fa-35", title: "Spider or Scorpion", filename: "35_EHAcademy - First Aid Course-Spider or Scorpion.mp4", duration: "1:03", parentSectionId: "fa-31" },
      { id: "fa-36", title: "Tick Bite", filename: "36_EHAcademy - First Aid Course-Tick Bite.mp4", duration: "1:15", parentSectionId: "fa-31" },
      { id: "fa-37", title: "Marine Life", filename: "37_EHAcademy - First Aid Course-Marine Life.mp4", duration: "1:18", parentSectionId: "fa-31" },
      { id: "fa-38", title: "Drowning", filename: "38_EHAcademy - First Aid Course-Drowning.mp4", duration: "1:13", parentSectionId: "fa-31" },
      { id: "fa-39", title: "Poisoning", filename: "39_EHAcademy - First Aid Course-Poisoning.mp4", duration: "1:30", parentSectionId: "fa-31" },
      { id: "fa-40", title: "Opioids and Overdose", filename: "40_EHAcademy - First Aid Course-Opioids and Overdose.mp4", duration: "1:17", parentSectionId: "fa-31" },
      { id: "fa-41", title: "TEMPERATURE RELATED ILLNESS", filename: "41_EHAcademy - First Aid Course-TEMPERATURE RELATED ILLNESS.mp4", duration: "0:28", isSectionHeader: true },
      { id: "fa-42", title: "Heat Related Illness", filename: "42_EHAcademy - First Aid Course-Heat Related Illness.mp4", duration: "1:20", parentSectionId: "fa-41" },
      { id: "fa-43", title: "Cold Related Illness", filename: "43_EHAcademy - First Aid Course-Cold Related Illness.mp4", duration: "1:27", parentSectionId: "fa-41" },
      { id: "fa-44", title: "Conclusion", filename: "44_EHAcademy - First Aid Course-Conclusion.mp4", duration: "0:28" }
    ]
  },
  {
    id: "pediatric",
    title: "Pediatric First Aid",
    subtitle: "Infant & Child Emergency Care",
    manualFilename: "pediatric_manual.pdf",
    isComingSoon: true,
    chapters: []
  }
];
