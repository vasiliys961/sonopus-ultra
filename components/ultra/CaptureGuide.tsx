type Locale = 'en' | 'ru'

const TEXT = {
  ru: {
    close: 'Закрыть',
    title: 'Карты захвата к аппаратам УЗИ',
    lead: 'Карта захвата берёт готовую картинку с видеовыхода и отдаёт её в компьютер по USB. Браузер видит её как камеру. Сырых данных датчика, DICOM и шкалы в миллиметрах в этом сигнале нет.',
    price: 'Цены ниже — ориентир в долларах с страниц производителей и продавцов. Это не цена магазина и не обещание, что устройство есть в наличии.',
    looks: 'Так выглядит',
    cardsTitle: 'Какие карты встречаются',
    machinesTitle: 'К каким аппаратам что брать',
    cards: [
      {
        kind: 'stick' as const,
        name: 'Компактная HDMI→USB',
        examples: 'Недорогая карта класса UGREEN. Elgato Cam Link 4K. AVerMedia BU113, если на компьютере только USB-C.',
        use: 'Первый выбор, когда на аппарате есть HDMI. Для браузера это обычная камера.',
        price: 'Ориентир около $20 у простой карты. Cam Link 4K — около $100, захват 1080p60, macOS 13+, кабель HDMI не входит. BU113 — около $100, вход HDMI и выход USB-C, до 1080p60. USB 2.0 ей не подходит.',
      },
      {
        kind: 'box' as const,
        name: 'Коробка с SDI и HDMI',
        examples: 'Blackmagic UltraStudio Express Recorder 3G.',
        use: 'Когда на большом аппарате выход SDI, а не HDMI. В браузере как обычная камера может не появиться.',
        price: 'Ориентир $179. Нужен USB4 или Thunderbolt. Для первого подключения SonOpus ultra её не берут.',
      },
      {
        kind: 'analog' as const,
        name: 'Аналоговая карта',
        examples: 'Карта с жёлтым RCA и круглым S-Video, например StarTech SVID2USB232.',
        use: 'Старый аппарат без HDMI: жёлтый «тюльпан» или S-Video.',
        price: 'Ориентир около $50. У SVID2USB232 в описании указана только Windows. На Mac такую карту надо проверить отдельно: браузер должен увидеть её как камеру.',
      },
    ],
    columns: ['Аппарат', 'Что на панели', 'Что поставить между аппаратом и компьютером'],
    rows: [
      ['Mindray DC-70 и соседние DC', 'HDMI, часто ещё VGA и S-Video', 'Кабель HDMI и карта HDMI→USB. В руководстве DC-70 для внешнего экрана указано 1280×1024, иначе картинка хуже.'],
      ['Mindray MX7', 'HDMI и S-Video', 'Та же карта HDMI→USB и кабель HDMI.'],
      ['GE Versana Active, Versana Essential, LOGIQ e последних выпусков', 'HDMI. У Essential в описании есть и VGA', 'Кабель HDMI и карта HDMI→USB. Если живой только VGA — активный переходник VGA→HDMI, затем карта.'],
      ['Philips Affiniti и EPIQ', 'DisplayPort', 'Активный переходник DisplayPort→HDMI, затем карта HDMI→USB. На части EPIQ переходник должен быть подключён до включения аппарата.'],
      ['Samsung HS и RS, Canon Aplio, Siemens Acuson, Esaote MyLab последних лет', 'HDMI или DVI. На старых тележках встречается VGA', 'HDMI сразу в карту. DVI-D — кабелем DVI→HDMI. VGA — активным переходником.'],
      ['Старые Mindray DP, старые GE и аппараты с жёлтым разъёмом', 'VGA, S-Video или RCA', 'Активный VGA→HDMI либо аналоговая USB-карта. На Mac её надо проверить в браузере.'],
      ['Butterfly, Philips Lumify, GE Vscan Air, Clarius', 'Отдельного видеовыхода нет', 'Карта захвата не подключается. На компьютер показывают экран телефона или планшета, где уже открыта программа зонда.'],
    ],
    note: 'Перед покупкой посмотрите заднюю панель конкретного аппарата. Надпись на коробке «4K» часто относится ко входу, а не к картинке, которую карта отдаёт в компьютер.',
  },
  en: {
    close: 'Close',
    title: 'Capture cards for ultrasound machines',
    lead: 'A capture card takes the finished picture from the video output and sends it to the computer over USB. The browser sees it as a camera. The signal has no raw probe data, no DICOM, and no millimeter scale.',
    price: 'The prices below are dollar figures from manufacturer and seller pages. They are not a shop price and not a promise that the device is in stock.',
    looks: 'What it looks like',
    cardsTitle: 'Cards you will see',
    machinesTitle: 'Which card for which machine',
    cards: [
      {
        kind: 'stick' as const,
        name: 'Compact HDMI to USB',
        examples: 'A low-cost card in the UGREEN class. Elgato Cam Link 4K. AVerMedia BU113 when the computer has only USB-C.',
        use: 'The first choice when the machine has HDMI. The browser treats it as an ordinary camera.',
        price: 'About $20 for a simple card. Cam Link 4K is about $100, 1080p60 capture, macOS 13+, HDMI cable not included. BU113 is about $100, HDMI in and USB-C out, up to 1080p60. USB 2.0 is not enough for it.',
      },
      {
        kind: 'box' as const,
        name: 'A box with SDI and HDMI',
        examples: 'Blackmagic UltraStudio Express Recorder 3G.',
        use: 'When a large machine outputs SDI rather than HDMI. It may not appear in the browser as an ordinary camera.',
        price: 'About $179. It needs USB4 or Thunderbolt. It is not the first device to buy for SonOpus ultra.',
      },
      {
        kind: 'analog' as const,
        name: 'An analog card',
        examples: 'A card with a yellow RCA socket and a round S-Video socket, such as StarTech SVID2USB232.',
        use: 'An old machine without HDMI: a yellow composite plug or S-Video.',
        price: 'About $50. The SVID2USB232 listing says Windows only. On a Mac, check that the browser can see the card as a camera.',
      },
    ],
    columns: ['Machine', 'What is on the panel', 'What goes between the machine and the computer'],
    rows: [
      ['Mindray DC-70 and nearby DC models', 'HDMI, often also VGA and S-Video', 'An HDMI cable and an HDMI-to-USB card. The DC-70 manual asks for 1280×1024 on an external display, or the picture is worse.'],
      ['Mindray MX7', 'HDMI and S-Video', 'The same HDMI-to-USB card and an HDMI cable.'],
      ['GE Versana Active, Versana Essential, recent LOGIQ e', 'HDMI. Essential is also listed with VGA', 'An HDMI cable and an HDMI-to-USB card. If only VGA is live, use an active VGA-to-HDMI adapter, then the card.'],
      ['Philips Affiniti and EPIQ', 'DisplayPort', 'An active DisplayPort-to-HDMI adapter, then an HDMI-to-USB card. On some EPIQ systems the adapter must be connected before the machine is switched on.'],
      ['Recent Samsung HS and RS, Canon Aplio, Siemens Acuson, Esaote MyLab', 'HDMI or DVI. Older carts may have VGA', 'HDMI goes straight into the card. DVI-D uses a DVI-to-HDMI cable. VGA needs an active adapter.'],
      ['Older Mindray DP, older GE, and machines with a yellow socket', 'VGA, S-Video, or RCA', 'An active VGA-to-HDMI adapter, or an analog USB card. On a Mac, check it in the browser.'],
      ['Butterfly, Philips Lumify, GE Vscan Air, Clarius', 'No separate video output', 'A capture card does not connect. Show the phone or tablet screen where the probe program is already open.'],
    ],
    note: 'Before buying, look at the rear panel of the actual machine. A “4K” label on the box often describes the input, not the picture the card sends to the computer.',
  },
} as const

export function CaptureGuide({ locale, onClose }: { locale: Locale; onClose: () => void }) {
  const copy = TEXT[locale]
  return (
    <div className="ultra-sheet" role="dialog" aria-modal="true" aria-labelledby="capture-guide-title" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="ultra-sheet-card">
        <div className="actions">
          <h2 id="capture-guide-title">{copy.title}</h2>
          <button type="button" className="ghost" onClick={onClose}>{copy.close}</button>
        </div>
        <p>{copy.lead}</p>
        <p className="hint">{copy.price}</p>
        <h3>{copy.cardsTitle}</h3>
        <div className="ultra-card-grid">
          {copy.cards.map((card) => (
            <article key={card.name} className="ultra-card">
              <CardSketch kind={card.kind} label={copy.looks} />
              <h3>{card.name}</h3>
              <p>{card.examples}</p>
              <p>{card.use}</p>
              <p className="hint">{card.price}</p>
            </article>
          ))}
        </div>
        <h3>{copy.machinesTitle}</h3>
        <div className="ultra-table-wrap">
          <table className="ultra-table">
            <thead>
              <tr>{copy.columns.map((column) => <th key={column}>{column}</th>)}</tr>
            </thead>
            <tbody>
              {copy.rows.map((row) => (
                <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">{copy.note}</p>
      </div>
    </div>
  )
}

function CardSketch({ kind, label }: { kind: 'stick' | 'box' | 'analog'; label: string }) {
  return (
    <figure>
      <svg viewBox="0 0 280 120" role="img" aria-label={label}>
        {kind === 'stick' ? <Stick /> : null}
        {kind === 'box' ? <Box /> : null}
        {kind === 'analog' ? <Analog /> : null}
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  )
}

function Stick() {
  return (
    <>
      <rect x="28" y="34" width="224" height="52" rx="10" fill="#173028" stroke="#3ecfb0" />
      <rect x="18" y="48" width="22" height="24" rx="3" fill="#8eaea3" />
      <rect x="238" y="46" width="28" height="28" rx="4" fill="#23443b" stroke="#e8f6f1" />
      <text x="124" y="64" textAnchor="middle" fill="#e8f6f1" fontSize="13">HDMI → USB</text>
    </>
  )
}

function Box() {
  return (
    <>
      <rect x="40" y="22" width="200" height="76" rx="8" fill="#173028" stroke="#3ecfb0" />
      <circle cx="78" cy="60" r="10" fill="#111" stroke="#e8f6f1" />
      <rect x="150" y="46" width="28" height="28" rx="3" fill="#23443b" stroke="#e8f6f1" />
      <text x="78" y="88" textAnchor="middle" fill="#8eaea3" fontSize="11">SDI</text>
      <text x="164" y="88" textAnchor="middle" fill="#8eaea3" fontSize="11">HDMI</text>
    </>
  )
}

function Analog() {
  return (
    <>
      <rect x="36" y="30" width="160" height="60" rx="10" fill="#173028" stroke="#3ecfb0" />
      <circle cx="214" cy="48" r="14" fill="#e2b15a" stroke="#e8f6f1" />
      <circle cx="248" cy="48" r="12" fill="#23443b" stroke="#e8f6f1" />
      <text x="214" y="86" textAnchor="middle" fill="#e2b15a" fontSize="11">RCA</text>
      <text x="248" y="86" textAnchor="middle" fill="#8eaea3" fontSize="11">S-Video</text>
    </>
  )
}
