'use client'

import { useEffect, useRef, useState } from 'react'
import { LanguageSwitch, useLocale } from '@/components/LocaleProvider'
import { dictationLine } from '@/lib/ultra/dictation'
import { applyMedicalLanguage } from '@/lib/ultra/medical-language'
import { polishDictation } from '@/lib/ultra/polish-dictation'
import { drawJpeg } from '@/lib/ultra/frame-jpeg'
import { coachLine, doctorLine, plainFailure } from '@/lib/ultra/coach'
import { GROUP_LABEL, localizationsByGroup, type UltrasoundLocalization } from '@/lib/ultra/organs'
import { useScanSession } from '@/components/scan/useScanSession'
import { CaptureGuide } from '@/components/ultra/CaptureGuide'

type Step = 'connect' | 'area' | 'sweep' | 'result'
type ProgramPlace = 'machine' | 'computer' | 'pocket' | 'practice'
type ProbeLink = 'cable' | 'wifi'

type Ear = 'off' | 'asking' | 'on' | 'denied' | 'unsupported'

interface SnapshotListener {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  onresult: ((event: { results: ArrayLike<{ readonly isFinal: boolean; readonly length: number; [index: number]: { transcript: string } }> }) => void) | null
}

function pictureSource(place: ProgramPlace, link: ProbeLink): 'uvc' | 'hdmi' | 'screen-capture' | 'synthetic' {
  if (place === 'practice') return 'synthetic'
  if (place === 'machine') return 'hdmi'
  if (place === 'computer' && link === 'cable') return 'uvc'
  return 'screen-capture'
}

const COPY = {
  ru: {
    brand: 'SonOpus ultra',
    lead: 'Подключите зонд, выберите область, проведите зондом.',
    steps: ['Подключите', 'Куда смотрим', 'Ведите', 'Вывод'],
    intro: 'Два пути. Напрямую: видеовыход аппарата через карту захвата в USB компьютера. Либо зонд и его программа на планшете, смартфоне или компьютере, кабелем или по Wi‑Fi.',
    howConnect: 'Как подключаем',
    direct: 'Напрямую в аппарат',
    probeProgram: 'Зонд и программа',
    where: 'Где программа',
    machineSteps: [
      'Аппарат УЗИ, видеовыход → кабель → карта захвата HDMI→USB → USB компьютера. Разъём HDMI на компьютере картинку не принимает.',
      'Чаще всего хватает кабеля HDMI. DVI подключается кабелем DVI→HDMI. DisplayPort и VGA — только активным переходником в HDMI.',
      'Карта захвата принимает картинку аппарата и отдаёт её в компьютер. Это не переходник, который выводит экран компьютера на монитор.',
      'Нажмите «Открыть картинку аппарата» и разрешите камеру. Если устройств несколько, выберите то, где виден аппарат, затем «Дальше».',
    ],
    openMachine: 'Открыть картинку аппарата',
    cards: 'Карты к аппаратам',
    machineCamera: 'Где виден аппарат',
    onComputer: 'На этом компьютере',
    onPocket: 'На планшете или смартфоне',
    howLink: 'Как зонд связан с программой',
    cable: 'Кабель',
    wifi: 'Wi‑Fi',
    practice: 'Без аппарата, для пробы',
    practiceNote: 'Учебная картинка. В карту пациента не уходит.',
    camera: 'Какой зонд',
    next: 'Дальше',
    guide: {
      computer: {
        cable: [
          'Подключите зонд кабелем к этому компьютеру и откройте программу аппарата.',
          'Нажмите «Открыть картинку». Браузер спросит разрешение — согласитесь.',
          'Если устройств несколько, выберите зонд.',
          'Когда картинка появилась, нажмите «Дальше».',
        ],
        wifi: [
          'Соедините зонд с программой на этом компьютере по Wi‑Fi и откройте живой кадр.',
          'Нажмите «Показать окно программы».',
          'В запросе браузера выберите окно программы аппарата.',
          'Когда картинка появилась, нажмите «Дальше».',
        ],
      },
      pocket: {
        cable: [
          'Подключите зонд кабелем к планшету или смартфону. На экране устройства должен быть живой кадр.',
          'Покажите этот экран на компьютере: кабелем или трансляцией экрана.',
          'Нажмите «Показать экран» и выберите экран планшета или телефона.',
          'Когда картинка появилась, нажмите «Дальше».',
        ],
        wifi: [
          'Соедините зонд с программой на планшете или смартфоне по Wi‑Fi. На экране должен быть живой кадр.',
          'Покажите этот экран на компьютере: кабелем или трансляцией экрана по Wi‑Fi.',
          'Нажмите «Показать экран» и выберите экран планшета или телефона.',
          'Когда картинка появилась, нажмите «Дальше».',
        ],
      },
    },
    practiceSteps: [
      'Зонд не нужен. Это учебная картинка.',
      'Нажмите «Показать учебную картинку».',
      'В карту пациента она не попадает.',
      'Когда картинка появилась, нажмите «Дальше».',
    ],
    openCable: 'Открыть картинку',
    openWindow: 'Показать окно программы',
    openScreen: 'Показать экран',
    openPractice: 'Показать учебную картинку',
    pictureReady: 'Картинка на месте. Можно выбирать область.',
    mirror: 'Если внутри картинки снова эта страница, нажмите «Открыть снова» и выберите окно программы аппарата. Это окно браузер снимать не должен.',
    again: 'Открыть снова',
    areaLead: 'Картинка уже открыта. Выберите орган и нажмите «Начните». Во время прохода над картинкой будет одна подсказка.',
    areaShared: 'Окно программы подключено. Смотрите в него. Здесь выберите орган и нажмите «Начните».',
    speak: 'Читать инструкцию',
    speakOn: 'Инструкция читается',
    speakHow: 'Чтобы слышать эту строку, нажмите «Читать инструкцию».',
    speakLead: 'Кнопка «Читать инструкцию» произносит строку, которая появится во время прохода. Микрофон от этого не включается.',
    micLead: 'Микрофон пишет диктовку, включая названные размеры. Перед заключением она приводится к языку УЗИ. Команда «снимок» оставляет кадр.',
    polishing: 'Привожу диктовку к языку УЗИ…',
    dictation: 'Диктовка',
    dictationHint: 'Эти слова уходят в заключение вместе с кадрами. Звук остаётся в этой вкладке.',
    noAudio: 'Голос на этом проходе не записан.',
    snapshotHint: 'Нажмите «Включить микрофон». Браузер спросит разрешение. Потом скажите: снимок. Либо нажмите «Оставить этот кадр».',
    listen: 'Включить микрофон',
    listenOn: 'Слушаю. Диктовка пишется. Скажите: снимок.',
    listenNoCommand: 'Диктовка пишется. Команду «снимок» этот браузер не слышит.',
    listenAsk: 'Браузер спрашивает микрофон. Согласитесь.',
    listenDenied: 'Микрофон не разрешён. Разрешите его в браузере или нажмите «Оставить этот кадр».',
    listenNone: 'Этот браузер команды не слышит. Нажмите «Оставить этот кадр».',
    keepFrame: 'Оставить этот кадр',
    kept: 'Кадр оставлен.',
    pinned: 'Оставлено кадров',
    scrub: 'Прокрутка петли',
    watchProgram: 'Смотрите в окно программы аппарата. Здесь картинку не повторяем, чтобы страница не снимала сама себя.',
    own: 'Своя область',
    ownPlaceholder: 'Если нужной нет в списке',
    start: 'Начните',
    stop: 'Остановите',
    live: 'Картинка с аппарата',
    writing: 'Отбираю кадры и пишу заключение…',
    empty: 'Проход пустой. Вернитесь и поводите датчиком.',
    reset: 'Сброс',
    cine: 'Кино прохода',
    series: 'Показательные кадры',
    conclusion: 'Черновик заключения',
    protocol: 'Протокол врача УЗИ',
    seen: 'Что видно',
    none: 'Отдельной формулировки нет. Это не значит, что всё в норме.',
    draft: 'Черновик',
    accepted: 'Принято',
    rejected: 'Отклонено',
    accept: 'Принять',
    reject: 'Отклонить',
    wording: 'Формулировка',
    disclaimer: 'Пока вы не приняли формулировку, это не протокол.',
  },
  en: {
    brand: 'SonOpus ultra',
    lead: 'Connect the probe, choose the area, sweep.',
    steps: ['Connect', 'Where', 'Sweep', 'Output'],
    intro: 'Two paths. Direct: the machine video output through a capture card into the computer USB. Or a probe and its program on a tablet, a phone, or a computer, by cable or Wi‑Fi.',
    howConnect: 'How to connect',
    direct: 'Directly into the machine',
    probeProgram: 'Probe and program',
    where: 'Where is the program',
    machineSteps: [
      'Ultrasound machine video output → cable → HDMI-to-USB capture card → computer USB. The HDMI socket on the computer does not receive the picture.',
      'An HDMI cable is enough on most machines. DVI uses a DVI-to-HDMI cable. DisplayPort and VGA need an active adapter into HDMI.',
      'The capture card takes the machine picture and sends it to the computer. It is not an adapter that sends the computer screen to a monitor.',
      'Press “Open the machine picture” and allow the camera. If there are several devices, choose the one that shows the machine, then “Next”.',
    ],
    openMachine: 'Open the machine picture',
    cards: 'Cards for machines',
    machineCamera: 'Where the machine is visible',
    onComputer: 'On this computer',
    onPocket: 'On a tablet or phone',
    howLink: 'How the probe links to the program',
    cable: 'Cable',
    wifi: 'Wi‑Fi',
    practice: 'No probe, for practice',
    practiceNote: 'Practice picture. It does not go into the patient chart.',
    camera: 'Which probe',
    next: 'Next',
    guide: {
      computer: {
        cable: [
          'Plug the probe into this computer with a cable and open the machine program.',
          'Press “Open the picture”. Allow it when the browser asks.',
          'If there are several devices, choose the probe.',
          'When the picture appears, press “Next”.',
        ],
        wifi: [
          'Link the probe to the program on this computer over Wi‑Fi and open the live image.',
          'Press “Show the program window”.',
          'In the browser prompt, choose the machine program window.',
          'When the picture appears, press “Next”.',
        ],
      },
      pocket: {
        cable: [
          'Plug the probe into the tablet or phone. The live image should be on that screen.',
          'Show that screen on the computer, by cable or by screen sharing.',
          'Press “Show the screen” and choose the tablet or phone screen.',
          'When the picture appears, press “Next”.',
        ],
        wifi: [
          'Link the probe to the program on the tablet or phone over Wi‑Fi. The live image should be on that screen.',
          'Show that screen on the computer, by cable or by Wi‑Fi screen sharing.',
          'Press “Show the screen” and choose the tablet or phone screen.',
          'When the picture appears, press “Next”.',
        ],
      },
    },
    practiceSteps: [
      'No probe is needed. This is a practice picture.',
      'Press “Show the practice picture”.',
      'It does not go into the patient chart.',
      'When the picture appears, press “Next”.',
    ],
    openCable: 'Open the picture',
    openWindow: 'Show the program window',
    openScreen: 'Show the screen',
    openPractice: 'Show the practice picture',
    pictureReady: 'The picture is on. You can choose the area.',
    mirror: 'If this page appears inside the picture, press “Open again” and choose the machine program window. This window should not be shared.',
    again: 'Open again',
    areaLead: 'The picture is already open. Choose the organ and press “Start”. During the pass, one hint stays above the picture.',
    areaShared: 'The program window is connected. Watch it there. Here, choose the organ and press “Start”.',
    speak: 'Read the instruction',
    speakOn: 'Reading the instruction',
    speakHow: 'To hear this line, press “Read the instruction”.',
    speakLead: '“Read the instruction” speaks the line that appears during the pass. This does not turn the microphone on.',
    micLead: 'The microphone records the dictation, including the sizes you say. Before the conclusion it is put into ultrasound wording. The command “snapshot” keeps the frame.',
    polishing: 'Putting the dictation into ultrasound wording…',
    dictation: 'Dictation',
    dictationHint: 'These words go into the conclusion together with the frames. The sound stays in this tab.',
    noAudio: 'No voice was recorded on this pass.',
    snapshotHint: 'Press “Turn on the microphone”. Allow it when the browser asks. Then say: snapshot. Or press “Keep this frame”.',
    listen: 'Turn on the microphone',
    listenOn: 'Listening. The dictation is recording. Say: snapshot.',
    listenNoCommand: 'The dictation is recording. This browser cannot hear “snapshot”.',
    listenAsk: 'The browser is asking for the microphone. Allow it.',
    listenDenied: 'The microphone was blocked. Allow it in the browser, or press “Keep this frame”.',
    listenNone: 'This browser cannot hear the command. Press “Keep this frame”.',
    keepFrame: 'Keep this frame',
    kept: 'Frame kept.',
    pinned: 'Frames kept',
    scrub: 'Loop',
    watchProgram: 'Watch the machine program window. The picture is not repeated here, so this page does not capture itself.',
    own: 'Another area',
    ownPlaceholder: 'If it is not in the list',
    start: 'Start',
    stop: 'Stop',
    live: 'Picture from the machine',
    writing: 'Choosing frames and writing the conclusion…',
    empty: 'The pass is empty. Go back and sweep the probe.',
    reset: 'Reset',
    cine: 'The pass',
    series: 'Representative frames',
    conclusion: 'Draft conclusion',
    protocol: 'Sonographer protocol',
    seen: 'What is seen',
    none: 'There is no separate wording. That does not mean everything is normal.',
    draft: 'Draft',
    accepted: 'Accepted',
    rejected: 'Rejected',
    accept: 'Accept',
    reject: 'Reject',
    wording: 'Wording',
    disclaimer: 'Until you accept the wording, this is not a report.',
  },
} as const

function connectHint(message: string, locale: 'en' | 'ru'): string {
  if (/denied|not allowed|permission|NotAllowed|отклон/i.test(message)) {
    return locale === 'ru'
      ? 'Браузер не разрешил доступ. Разрешите камеру или экран и нажмите ещё раз.'
      : 'The browser blocked access. Allow the camera or the screen and press again.'
  }
  if (/not found|NotFound|NotReadable|device/i.test(message)) {
    return locale === 'ru'
      ? 'Картинка не нашлась. Проверьте кабель и нажмите ещё раз.'
      : 'No picture was found. Check the cable and press again.'
  }
  return locale === 'ru'
    ? 'Картинка не открылась. Проверьте подключение и нажмите ещё раз.'
    : 'The picture did not open. Check the connection and press again.'
}

function Still({ jpeg, pinned }: { jpeg: string; pinned?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) drawJpeg(ref.current, jpeg)
  }, [jpeg])
  return <canvas ref={ref} className={pinned ? 'pinned' : undefined} />
}

export function UltraScreen() {
  const session = useScanSession()
  const { locale, text, label } = useLocale()
  const copy = COPY[locale]
  const [step, setStep] = useState<Step>('connect')
  const [place, setPlace] = useState<ProgramPlace>('machine')
  const [link, setLink] = useState<ProbeLink>('cable')
  const [own, setOwn] = useState('')
  const [organId, setOrganId] = useState('liver')
  const organRef = useRef<UltrasoundLocalization | null>(localizationsByGroup()[0]?.items[0] ?? null)
  const primed = useRef(false)
  const [tick, setTick] = useState(0)
  const [speak, setSpeak] = useState(false)
  const [ear, setEar] = useState<Ear>('off')
  const [kept, setKept] = useState(false)
  const [dictation, setDictation] = useState('')
  const [dictationUrl, setDictationUrl] = useState('')
  const [recording, setRecording] = useState(false)
  const [polishing, setPolishing] = useState(false)
  const [cardsOpen, setCardsOpen] = useState(false)
  const recRef = useRef<SnapshotListener | null>(null)
  const keptTimer = useRef(0)
  const [loopIndex, setLoopIndex] = useState(0)
  const holdLoop = useRef(false)
  const spoken = useRef('')
  const customName = useRef('')
  const sweepStarted = useRef(0)
  if (step === 'connect' || step === 'area') sweepStarted.current = 0
  if (step === 'sweep' && sweepStarted.current === 0) sweepStarted.current = Date.now()
  const cineRef = useRef<HTMLCanvasElement>(null)
  const asked = useRef(false)

  useEffect(() => {
    if (primed.current) return
    primed.current = true
    const organ = organRef.current
    if (organ) session.setModuleId(organ.moduleId)
    // Один раз привязать первую локализацию, пока врач ещё на первом шаге.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (step !== 'sweep') return
    sweepStarted.current = Date.now()
    const organ = organRef.current
    if (organ) {
      session.setRegionName(locale === 'ru' ? organ.ru : organ.en)
      session.setQuestion(organ.question[locale])
    } else if (customName.current) {
      session.setRegionName(customName.current)
      session.setQuestion(locale === 'ru' ? `Что видно: ${customName.current}?` : `What is seen: ${customName.current}?`)
    }
    session.setRegionConfirmed(true)
    session.setPassRecording(true)
    if (!session.running) void session.start()
    const clock = window.setInterval(() => setTick((value) => value + 1), 1000)
    return () => {
      window.clearInterval(clock)
      session.setPassRecording(false)
    }
    // Сессия читается один раз при входе в проход: ссылки на видео уже стоят.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const series = session.chosenFrames

  useEffect(() => {
    const saved = window.localStorage.getItem('ultra-speak')
    setSpeak(saved === '1')
  }, [])

  useEffect(() => {
    if (!cardsOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setCardsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cardsOpen])

  useEffect(() => {
    if (step === 'area' || step === 'sweep') return
    recRef.current?.stop()
    recRef.current = null
    setEar('off')
    setRecording(false)
    setKept(false)
    window.clearTimeout(keptTimer.current)
    const recorder = recorderRef.current
    const stream = micStreamRef.current
    recorderRef.current = null
    micStreamRef.current = null
    if (step === 'result' && recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        chunksRef.current = []
        stream?.getTracks().forEach((track) => track.stop())
        if (blob.size === 0) return
        setDictationUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
      }
      recorder.stop()
      return
    }
    stream?.getTracks().forEach((track) => track.stop())
    chunksRef.current = []
    dictationRef.current = ''
    interimRef.current = ''
    setDictation('')
    setDictationUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return ''
    })
  }, [step])

  const audioRef = useRef<AudioContext | null>(null)
  const keepRef = useRef<() => void>(() => {})
  const dictationRef = useRef('')
  const interimRef = useRef('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  function unlockAudio() {
    const host = window as Window & { webkitAudioContext?: typeof AudioContext }
    const Ctor = window.AudioContext ?? host.webkitAudioContext
    if (!Ctor) return
    if (!audioRef.current) audioRef.current = new Ctor()
    if (audioRef.current.state === 'suspended') void audioRef.current.resume()
  }

  function playKeptTone() {
    const ctx = audioRef.current
    if (!ctx) return
    const run = () => {
      const now = ctx.currentTime
      const gain = ctx.createGain()
      gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34)
      ;[880, 1320].forEach((frequency, index) => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = frequency
        osc.connect(gain)
        const at = now + index * 0.12
        osc.start(at)
        osc.stop(at + 0.1)
      })
    }
    if (ctx.state === 'suspended') void ctx.resume().then(run)
    else run()
  }

  function keepFrame() {
    unlockAudio()
    if (!session.pinLatestFrame()) return
    setKept(true)
    playKeptTone()
    window.clearTimeout(keptTimer.current)
    keptTimer.current = window.setTimeout(() => setKept(false), 2500)
  }
  keepRef.current = keepFrame

  function captureMic() {
    if (recorderRef.current?.state === 'recording') return
    const pending = navigator.mediaDevices.getUserMedia({ audio: true })
    void pending.then((stream) => {
      micStreamRef.current?.getTracks().forEach((track) => track.stop())
      micStreamRef.current = stream
      if (typeof MediaRecorder === 'undefined') return
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.start(1000)
      recorderRef.current = recorder
      setRecording(true)
    }).catch(() => {
      setEar((current) => (current === 'on' || current === 'unsupported' ? current : 'denied'))
    })
  }

  function listenForSnapshot() {
    unlockAudio()
    if (recorderRef.current?.state === 'recording') return
    captureMic()
    const host = window as Window & {
      SpeechRecognition?: new () => SnapshotListener
      webkitSpeechRecognition?: new () => SnapshotListener
    }
    const Ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition
    if (!Ctor) {
      setEar('unsupported')
      return
    }
    recRef.current?.stop()
    const rec = new Ctor()
    rec.lang = locale === 'ru' ? 'ru-RU' : 'en-US'
    rec.continuous = true
    rec.interimResults = true
    rec.onstart = () => setEar('on')
    rec.onresult = (event) => {
      const result = event.results[event.results.length - 1]
      const piece = result?.[0]?.transcript ?? ''
      if (/снимок|snapshot/i.test(piece)) keepRef.current()
      interimRef.current = piece
      if (!result?.isFinal) return
      interimRef.current = ''
      const line = applyMedicalLanguage(dictationLine(piece))
      if (!line) return
      const next = dictationRef.current ? `${dictationRef.current} ${line}` : line
      dictationRef.current = next
      setDictation(next)
    }
    rec.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setEar('denied')
    }
    rec.onend = () => {
      if (recRef.current !== rec) return
      window.setTimeout(() => {
        if (recRef.current !== rec) return
        try {
          rec.start()
        } catch {
          setEar('denied')
        }
      }, 300)
    }
    recRef.current = rec
    setEar('asking')
    try {
      rec.start()
    } catch {
      setEar('denied')
    }
  }

  useEffect(() => {
    if (step !== 'result' || session.passFrames.length === 0) return
    const timer = window.setInterval(() => {
      if (holdLoop.current) return
      setLoopIndex((index) => (index + 1) % session.passFrames.length)
    }, 200)
    return () => window.clearInterval(timer)
  }, [step, session.passFrames.length])

  useEffect(() => {
    const frame = session.passFrames[loopIndex]
    if (step === 'result' && cineRef.current && frame) drawJpeg(cineRef.current, frame.jpeg)
  }, [step, loopIndex, session.passFrames])

  const coach = coachLine({
    score: session.score,
    moduleId: session.moduleId,
    elapsedMs: Date.now() - sweepStarted.current,
    locale,
  })
  void tick

  function say(text: string) {
    if (!text || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = locale === 'ru' ? 'ru-RU' : 'en-US'
    window.speechSynthesis.speak(utterance)
    spoken.current = text
  }

  function toggleSpeak() {
    const next = !speak
    window.localStorage.setItem('ultra-speak', next ? '1' : '0')
    setSpeak(next)
    if (next) say(coach)
    else window.speechSynthesis?.cancel()
  }

  useEffect(() => {
    if (step !== 'sweep' || !speak || coach === spoken.current) return
    say(coach)
  }, [step, speak, coach, locale])

  useEffect(() => {
    const next = pictureSource(place, link)
    if (session.source !== next) {
      session.stop()
      session.setSource(next)
    }
    // Источник картинки следует за местом программы и типом связи.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, link])

  const steps = place === 'practice' ? copy.practiceSteps : place === 'machine' ? copy.machineSteps : copy.guide[place][link]
  const openLabel = place === 'practice'
    ? copy.openPractice
    : place === 'machine'
      ? copy.openMachine
      : place === 'pocket'
        ? copy.openScreen
        : link === 'wifi'
          ? copy.openWindow
          : copy.openCable

  function choosePlace(next: ProgramPlace) {
    if (next !== place) session.stop()
    setPlace(next)
  }

  function chooseLink(next: ProbeLink) {
    if (next !== link) session.stop()
    setLink(next)
  }

  function chooseOrgan(organ: UltrasoundLocalization) {
    setOwn('')
    setOrganId(organ.id)
    organRef.current = organ
    customName.current = ''
    session.setModuleId(organ.moduleId)
  }

  function chooseOwn() {
    const name = own.trim()
    if (!name) return
    setOrganId('')
    organRef.current = null
    customName.current = name
    session.setModuleId('organ-sweep')
    session.setRegionName(name)
  }

  function spokenForModel(): string {
    const tail = applyMedicalLanguage(dictationLine(interimRef.current))
    const base = dictationRef.current
    if (!tail || base.endsWith(tail)) return base
    return base ? `${base} ${tail}` : tail
  }

  async function finish() {
    const spoken = spokenForModel()
    interimRef.current = ''
    session.setPassRecording(false)
    session.stop()
    setStep('result')
    setPolishing(true)
    let medical = spoken
    try {
      medical = spoken ? await polishDictation(spoken) : ''
    } finally {
      setPolishing(false)
    }
    dictationRef.current = medical
    setDictation(medical)
    session.setNote(medical)
    if (asked.current || session.passFrames.length === 0) return
    asked.current = true
    await session.diagnose(medical)
  }

  function restart() {
    asked.current = false
    customName.current = ''
    window.speechSynthesis?.cancel()
    session.stop()
    session.setPassRecording(false)
    session.setResult(null)
    setStep('connect')
  }

  const stepIndex = step === 'connect' ? 0 : step === 'area' ? 1 : step === 'sweep' ? 2 : 3
  const stated = (session.result?.whyCannotAssess ?? []).flatMap((reason) => {
    const line = doctorLine(reason, locale)
    return line ? [text(line)] : []
  })
  const failure = session.result?.outcome === 'error'
    ? (stated.join(' ') || plainFailure(session.result.whyCannotAssess?.[0] ?? session.error, locale))
    : session.error
      ? plainFailure(session.error, locale)
      : ''

  return (
    <main className="shell ultra">
      <header className="home-hero">
        <div>
          <p className="brand">{copy.brand}</p>
          <h1>{copy.lead}</h1>
        </div>
        <LanguageSwitch />
      </header>
      <ol className="ultra-steps">
        {copy.steps.map((name, index) => (
          <li key={name} className={index === stepIndex ? 'current' : index < stepIndex ? 'done' : undefined}>{name}</li>
        ))}
      </ol>

      {step === 'connect' ? (
        <section className="panel pad">
          <p>{copy.intro}</p>
          <div className="ultra-group">
            <h2>{copy.howConnect}</h2>
            <div className="ultra-choices">
              <button type="button" className={place === 'machine' ? 'primary' : 'ghost'} onClick={() => choosePlace('machine')}>{copy.direct}</button>
              <button type="button" className={place === 'computer' || place === 'pocket' ? 'primary' : 'ghost'} onClick={() => choosePlace(place === 'pocket' ? 'pocket' : 'computer')}>{copy.probeProgram}</button>
            </div>
          </div>
          {place === 'computer' || place === 'pocket' ? (
            <div className="ultra-group">
              <h2>{copy.where}</h2>
              <div className="ultra-choices">
                <button type="button" className={place === 'computer' ? 'primary' : 'ghost'} onClick={() => choosePlace('computer')}>{copy.onComputer}</button>
                <button type="button" className={place === 'pocket' ? 'primary' : 'ghost'} onClick={() => choosePlace('pocket')}>{copy.onPocket}</button>
              </div>
            </div>
          ) : null}
          {place === 'computer' || place === 'pocket' ? (
            <div className="ultra-group">
              <h2>{copy.howLink}</h2>
              <div className="ultra-choices">
                <button type="button" className={link === 'cable' ? 'primary' : 'ghost'} onClick={() => chooseLink('cable')}>{copy.cable}</button>
                <button type="button" className={link === 'wifi' ? 'primary' : 'ghost'} onClick={() => chooseLink('wifi')}>{copy.wifi}</button>
              </div>
            </div>
          ) : null}
          <ol className="ultra-steps-list">
            {steps.map((line) => <li key={line}>{line}</li>)}
          </ol>
          {place === 'machine' ? (
            <div className="actions">
              <button type="button" className="ghost" onClick={() => setCardsOpen(true)}>{copy.cards}</button>
            </div>
          ) : null}
          <button type="button" className={place === 'practice' ? 'primary' : 'ghost'} onClick={() => choosePlace(place === 'practice' ? 'computer' : 'practice')}>{copy.practice}</button>
          {(pictureSource(place, link) === 'uvc' || pictureSource(place, link) === 'hdmi') && session.devices.length > 1 ? (
            <label className="row">
              {place === 'machine' ? copy.machineCamera : copy.camera}
              <select value={session.deviceId} onChange={(event) => session.setDeviceId(event.target.value)}>
                {session.devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
                ))}
              </select>
            </label>
          ) : null}
          {session.error && !session.running ? <p className="banner bad">{connectHint(session.error, locale)}</p> : null}
        </section>
      ) : null}

      {step !== 'result' ? (
        <section className={`panel ${step === 'sweep' && session.source !== 'screen-capture' ? 'stage' : 'ultra-preview'} ${session.running ? '' : 'ultra-preview-off'}`}>
          <div className={session.source === 'screen-capture' ? 'ultra-preview-off' : undefined}>
            <video ref={session.videoRef} className={session.source === 'synthetic' ? 'hidden' : undefined} muted playsInline aria-label={copy.live} />
            <canvas ref={session.previewRef} className={session.source === 'synthetic' ? undefined : 'hidden'} aria-label={copy.live} />
            <canvas ref={session.sampleRef} className="hidden" />
          </div>
          {step === 'sweep' ? (
            <p className={`banner ${ear === 'on' ? 'ok' : ear === 'denied' || ear === 'unsupported' ? 'bad' : ''}`}>
              {ear === 'on' ? copy.listenOn : ear === 'asking' ? copy.listenAsk : ear === 'denied' ? copy.listenDenied : ear === 'unsupported' ? (recording ? copy.listenNoCommand : copy.listenNone) : copy.snapshotHint}
            </p>
          ) : null}
          {step === 'sweep' && kept ? <p className="banner ok">{copy.kept}</p> : null}
          {step === 'sweep' && session.pinnedCount > 0 ? <p className="hint">{copy.pinned}: {session.pinnedCount}</p> : null}
          {session.running && session.source === 'screen-capture' ? <p className="banner">{copy.watchProgram}</p> : null}
          {step === 'connect' && session.running && session.source !== 'screen-capture' ? <p className="banner ok">{copy.pictureReady}</p> : null}
          {step === 'connect' && session.running && session.source === 'screen-capture' ? <p className="banner warn">{copy.mirror}</p> : null}
          {step === 'sweep' ? (
            <>
              <p className="banner">{coach}</p>
              {speak ? null : <p className="hint">{copy.speakHow}</p>}
              {session.error ? <p className="banner bad">{plainFailure(session.error, locale)}</p> : null}
              <div className="actions">
                {ear === 'on' || (recording && ear === 'unsupported') ? null : (
                  <button type="button" className="primary" onClick={listenForSnapshot} disabled={ear === 'asking'}>{copy.listen}</button>
                )}
                <button type="button" className="ghost" onClick={keepFrame}>{copy.keepFrame}</button>
                <button type="button" className={speak ? 'primary' : 'ghost'} onClick={toggleSpeak}>{speak ? copy.speakOn : copy.speak}</button>
                <button type="button" className="primary" onClick={() => void finish()}>{copy.stop}</button>
                <button type="button" className="ghost" onClick={restart}>{copy.reset}</button>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {step === 'connect' ? (
        <div className="actions">
          <button type="button" className={session.running ? 'ghost' : 'primary'} onClick={() => void session.start()}>{session.running ? copy.again : openLabel}</button>
          <button type="button" className={session.running ? 'primary' : 'ghost'} disabled={!session.running} onClick={() => setStep('area')}>{copy.next}</button>
          <button type="button" className="ghost" onClick={restart}>{copy.reset}</button>
        </div>
      ) : null}

      {step === 'area' ? (
        <section className="panel pad">
          <div className="actions">
            {ear === 'on' || (recording && ear === 'unsupported') ? null : (
              <button type="button" className="primary" onClick={listenForSnapshot} disabled={ear === 'asking'}>{copy.listen}</button>
            )}
            <button type="button" className={speak ? 'primary' : 'ghost'} onClick={toggleSpeak}>{speak ? copy.speakOn : copy.speak}</button>
          </div>
          {ear === 'on' ? <p className="banner ok">{copy.listenOn}</p> : ear === 'asking' ? <p className="banner">{copy.listenAsk}</p> : ear === 'denied' ? <p className="banner bad">{copy.listenDenied}</p> : ear === 'unsupported' ? <p className="banner bad">{recording ? copy.listenNoCommand : copy.listenNone}</p> : <p className="hint">{copy.micLead}</p>}
          <p>{session.source === 'screen-capture' ? copy.areaShared : copy.areaLead}</p>
          {localizationsByGroup().map(({ group, items }) => (
            <div key={group} className="ultra-group">
              <h2>{GROUP_LABEL[locale][group]}</h2>
              <div className="ultra-choices">
                {items.map((organ) => (
                  <button
                    key={organ.id}
                    type="button"
                    className={organId === organ.id ? 'primary' : 'ghost'}
                    onClick={() => chooseOrgan(organ)}
                  >
                    {locale === 'ru' ? organ.ru : organ.en}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <label className="row">
            {copy.own}
            <input value={own} placeholder={copy.ownPlaceholder} onChange={(event) => setOwn(event.target.value)} />
          </label>
          <div className="actions">
            <button type="button" className="ghost" onClick={() => chooseOwn()} disabled={!own.trim()}>{copy.own}</button>
            <button type="button" className={speak ? 'primary' : 'ghost'} onClick={toggleSpeak}>{speak ? copy.speakOn : copy.speak}</button>
            <button type="button" className="primary" onClick={() => { unlockAudio(); if (own.trim()) chooseOwn(); setStep('sweep') }}>{copy.start}</button>
            <button type="button" className="ghost" onClick={restart}>{copy.reset}</button>
          </div>
        </section>
      ) : null}

      {step === 'result' ? (
        <section className="panel stage">
          {session.source === 'synthetic' ? <p className="hint">{copy.practiceNote}</p> : null}
          <h2>{copy.cine}</h2>
          <canvas ref={cineRef} aria-label={copy.cine} />
          {session.passFrames.length > 1 ? (
            <label className="row">
              {copy.scrub}
              <input
                type="range"
                min={0}
                max={session.passFrames.length - 1}
                value={Math.min(loopIndex, session.passFrames.length - 1)}
                onPointerDown={() => { holdLoop.current = true }}
                onPointerUp={() => { holdLoop.current = false }}
                onChange={(event) => setLoopIndex(Number(event.target.value))}
              />
            </label>
          ) : null}
          <h2>{copy.series}</h2>
          {series.length === 0 ? <p>{session.diagnosing ? copy.writing : copy.empty}</p> : (
            <div className="ultra-strip">
              {series.map((shot) => (
                <Still key={shot.sequenceNumber} jpeg={shot.jpeg} pinned={shot.pinned} />
              ))}
            </div>
          )}
          <h2>{copy.dictation}</h2>
          {polishing ? <p className="banner">{copy.polishing}</p> : null}
          <p className="hint">{copy.dictationHint}</p>
          {dictationUrl ? <audio className="ultra-dictation" controls src={dictationUrl} /> : <p className="hint">{copy.noAudio}</p>}
          <textarea value={dictation} onChange={(event) => { dictationRef.current = event.target.value; setDictation(event.target.value) }} />
          <h2>{copy.conclusion}</h2>
          <p className="hint">{copy.disclaimer}</p>
          {session.result?.sonographerReport ? (
            <>
              <h3>{copy.protocol}</h3>
              {session.result.sonographerReport.split('\n').filter((line) => line.trim()).map((line, index) => (
                <p key={`${index}-${line.slice(0, 24)}`}>{line}</p>
              ))}
            </>
          ) : null}
          {session.diagnosing ? <p className="banner">{copy.writing}</p> : null}
          {failure && !session.diagnosing ? <p className="banner bad">{failure}</p> : null}
          {session.result && session.result.outcome !== 'error' ? (
            <>
              <h3>{copy.seen}</h3>
              {session.result.observations.length === 0 ? <p className="muted">{copy.none}</p> : null}
              {session.result.observations.map((item) => (
                <p key={item.id}>{item.feature} — {label(item.polarity)}</p>
              ))}
              {(session.result.whyCannotAssess ?? []).map((reason) => {
                const line = doctorLine(reason, locale)
                return line ? <p key={reason}>{text(line)}</p> : null
              })}
              {session.result.differential.length === 0 ? <p className="muted">{copy.none}</p> : null}
              {session.result.differential.map((item) => (
                <article key={item.id} className="dx">
                  <header>
                    <strong>{item.status === 'operator_accepted' ? copy.accepted : item.status === 'operator_rejected' ? copy.rejected : copy.draft}</strong>
                  </header>
                  <label>
                    {copy.wording}
                    <input value={item.label} onChange={(event) => session.editLabel(item.id, event.target.value)} disabled={item.status !== 'model_proposed'} />
                  </label>
                  <div className="actions">
                    <button type="button" className="primary" onClick={() => session.accept(item.id)}>{copy.accept}</button>
                    <button type="button" className="danger" onClick={() => session.reject(item.id)}>{copy.reject}</button>
                  </div>
                </article>
              ))}
            </>
          ) : null}
          <div className="actions">
            <button type="button" className="ghost" onClick={restart}>{copy.reset}</button>
          </div>
        </section>
      ) : null}
      {cardsOpen ? <CaptureGuide locale={locale} onClose={() => setCardsOpen(false)} /> : null}
    </main>
  )
}
