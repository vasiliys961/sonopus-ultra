import type { Locale } from '@/lib/i18n/locales'
import { INTL } from '@/lib/ultra/screen-intl'

export interface ScreenCopy {
  brand: string
  lead: string
  steps: string[]
  intro: string
  howConnect: string
  direct: string
  probeProgram: string
  where: string
  machineSteps: string[]
  openMachine: string
  cards: string
  machineCamera: string
  onComputer: string
  onPocket: string
  howLink: string
  cable: string
  wifi: string
  practice: string
  practiceNote: string
  camera: string
  next: string
  guide: {
    computer: { cable: string[]; wifi: string[] }
    pocket: { cable: string[]; wifi: string[] }
  }
  practiceSteps: string[]
  openCable: string
  openWindow: string
  openScreen: string
  openPractice: string
  pictureReady: string
  mirror: string
  again: string
  areaLead: string
  areaShared: string
  speak: string
  speakOn: string
  speakHow: string
  speakLead: string
  micLead: string
  polishing: string
  dictation: string
  dictationHint: string
  noAudio: string
  snapshotHint: string
  listen: string
  listenOn: string
  listenNoCommand: string
  listenAsk: string
  listenDenied: string
  listenNone: string
  keepFrame: string
  kept: string
  pinned: string
  scrub: string
  watchProgram: string
  own: string
  ownPlaceholder: string
  start: string
  stop: string
  live: string
  writing: string
  empty: string
  reset: string
  cine: string
  series: string
  conclusion: string
  protocol: string
  seen: string
  none: string
  draft: string
  accepted: string
  rejected: string
  accept: string
  reject: string
  wording: string
  disclaimer: string
}

const ru: ScreenCopy = {
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
}

const en: ScreenCopy = {
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
}

const HINT = {
  denied: {
    ru: 'Браузер не разрешил доступ. Разрешите камеру или экран и нажмите ещё раз.',
    en: 'The browser blocked access. Allow the camera or the screen and press again.',
    es: 'El navegador bloqueó el acceso. Permita la cámara o la pantalla y pulse de nuevo.',
    fr: 'Le navigateur a bloqué l’accès. Autorisez la caméra ou l’écran et appuyez encore.',
    ar: 'المتصفح منع الوصول. اسمح بالكاميرا أو الشاشة ثم اضغط مرة أخرى.',
    hi: 'ब्राउज़र ने पहुँच रोक दी। कैमरा या स्क्रीन की अनुमति दें और फिर दबाएँ।',
    'pt-BR': 'O navegador bloqueou o acesso. Permita a câmera ou a tela e pressione de novo.',
    id: 'Peramban menolak akses. Izinkan kamera atau layar, lalu tekan lagi.',
    ms: 'Pelayar menyekat akses. Benarkan kamera atau skrin, kemudian tekan lagi.',
    tr: 'Tarayıcı erişimi engelledi. Kameraya veya ekrana izin verip yeniden basın.',
    'zh-CN': '浏览器拒绝了访问。请允许摄像头或屏幕，然后再按一次。',
  },
  missing: {
    ru: 'Картинка не нашлась. Проверьте кабель и нажмите ещё раз.',
    en: 'No picture was found. Check the cable and press again.',
    es: 'No apareció la imagen. Revise el cable y pulse de nuevo.',
    fr: 'Aucune image. Vérifiez le câble et appuyez encore.',
    ar: 'لم تظهر الصورة. افحص الكابل ثم اضغط مرة أخرى.',
    hi: 'चित्र नहीं मिला। केबल जाँचें और फिर दबाएँ।',
    'pt-BR': 'A imagem não apareceu. Verifique o cabo e pressione de novo.',
    id: 'Gambar tidak ditemukan. Periksa kabel dan tekan lagi.',
    ms: 'Gambar tidak dijumpai. Periksa kabel dan tekan lagi.',
    tr: 'Görüntü bulunamadı. Kabloyu kontrol edip yeniden basın.',
    'zh-CN': '没有找到图像。请检查线缆，然后再按一次。',
  },
  other: {
    ru: 'Картинка не открылась. Проверьте подключение и нажмите ещё раз.',
    en: 'The picture did not open. Check the connection and press again.',
    es: 'La imagen no se abrió. Revise la conexión y pulse de nuevo.',
    fr: 'L’image ne s’est pas ouverte. Vérifiez le branchement et appuyez encore.',
    ar: 'لم تُفتح الصورة. افحص التوصيل ثم اضغط مرة أخرى.',
    hi: 'चित्र नहीं खुला। कनेक्शन जाँचें और फिर दबाएँ।',
    'pt-BR': 'A imagem não abriu. Verifique a conexão e pressione de novo.',
    id: 'Gambar tidak terbuka. Periksa sambungan dan tekan lagi.',
    ms: 'Gambar tidak terbuka. Periksa sambungan dan tekan lagi.',
    tr: 'Görüntü açılmadı. Bağlantıyı kontrol edip yeniden basın.',
    'zh-CN': '图像没有打开。请检查连接，然后再按一次。',
  },
} satisfies Record<string, Record<Locale, string>>

export function doctorCopy(locale: Locale): ScreenCopy {
  if (locale === 'ru') return ru
  if (locale === 'en') return en
  return INTL[locale]
}

export function connectHint(message: string, locale: Locale): string {
  if (/denied|not allowed|permission|NotAllowed|отклон/i.test(message)) return HINT.denied[locale]
  if (/not found|NotFound|NotReadable|device/i.test(message)) return HINT.missing[locale]
  return HINT.other[locale]
}
