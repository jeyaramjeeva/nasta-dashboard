import { ArrowDown, ArrowUp, Check, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  DEFAULT_QUESTION_ORDER,
  DEFAULT_REVIEW_FORM_CONFIG,
  FOOD_RATING_LABELS,
  REVIEW_UI,
  appendLocalReview,
  fetchReviewFormConfig,
  itemOtherId,
  loadReviewLang,
  moveChipInList,
  moveQuestionKey,
  newReviewChip,
  newReviewId,
  normalizeReview,
  publishReviewFormConfig,
  reviewMenuChips,
  saveReviewLang,
  thankYouMessage,
  type CustomReviewQuestion,
  type CustomerReview,
  type RecommendLevel,
  type ReviewChip,
  type ReviewFormConfig,
  type ReviewLang,
  type ReviewQuestionKey,
  type SpicyLevel,
} from '../lib/customerReviews'
import { isGuestUser } from '../lib/guestAuth'
import { loadLocalSiteConfig } from '../lib/siteConfig'
import { detectLanguage } from '../lib/textIntel'

type ChipListKey =
  | 'spicy'
  | 'improve'
  | 'wantTry'
  | 'favorites'
  | 'visitReasons'
  | 'recommend'
  | 'eatExtras'

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
}

function StarPick({
  value,
  onChange,
  label,
  labels,
}: {
  value: number
  onChange: (n: number) => void
  label: string
  labels?: string[]
}) {
  return (
    <div className="review-stars" role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`review-star ${value >= n ? 'active' : ''}`}
          onClick={() => onChange(n)}
          aria-label={labels?.[n - 1] || `${n}`}
        >
          <Star size={28} fill={value >= n ? 'currentColor' : 'none'} />
          {labels?.[n - 1] && (
            <span className={`review-star__label ${value === n ? 'active' : ''}`}>
              {labels[n - 1]}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export function PublicReview() {
  const { user } = useAuth()
  const menuChips = useMemo(() => reviewMenuChips(), [])
  const [form, setForm] = useState<ReviewFormConfig>(DEFAULT_REVIEW_FORM_CONFIG)
  const [lang, setLang] = useState<ReviewLang>(() => loadReviewLang())
  const t = REVIEW_UI[lang]
  const siteText = loadLocalSiteConfig().text
  const brandName = siteText.brandName || siteText.reviewEyebrow || 'Nasta Zentrum'
  const otherId = itemOtherId()

  const [overallRating, setOverallRating] = useState(0)
  const [name, setName] = useState('')
  const [items, setItems] = useState<string[]>([])
  const [itemsOther, setItemsOther] = useState('')
  const [spicyOk, setSpicyOk] = useState<SpicyLevel | null>(null)
  const [foodRating, setFoodRating] = useState(0)
  const [improve, setImprove] = useState<string[]>([])
  const [serviceRating, setServiceRating] = useState(0)
  const [recommend, setRecommend] = useState<RecommendLevel | null>(null)
  const [wantToTry, setWantToTry] = useState<string[]>([])
  const [wantOther, setWantOther] = useState('')
  const [visitReason, setVisitReason] = useState<string[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [smileNote, setSmileNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<CustomerReview | null>(null)
  const [customAnswers, setCustomAnswers] = useState<Record<string, string | string[]>>({})
  const [editMode, setEditMode] = useState(false)
  const [savingForm, setSavingForm] = useState(false)
  const [formError, setFormError] = useState('')

  const restOptional = overallRating >= 4
  const staffCanEdit = Boolean(user && !isGuestUser(user))
  const showAteOther = items.includes(otherId)

  useEffect(() => {
    void fetchReviewFormConfig().then(setForm)
  }, [])

  function switchLang(next: ReviewLang) {
    setLang(next)
    saveReviewLang(next)
    setError('')
  }

  function updateChipList(key: ChipListKey, next: ReviewChip[]) {
    setForm((current) => ({ ...current, [key]: next }))
  }

  function addChip(key: ChipListKey) {
    const en = window.prompt('Option in English:')
    if (!en?.trim()) return
    const de = window.prompt('Option in German (leave empty to use English):')?.trim() || en.trim()
    updateChipList(key, [...form[key], newReviewChip(en.trim(), de)])
  }

  function moveQuestion(key: ReviewQuestionKey, dir: 'up' | 'down') {
    setForm((current) => ({
      ...current,
      questionOrder: moveQuestionKey(current.questionOrder || DEFAULT_QUESTION_ORDER, key, dir),
    }))
  }

  function addCustomQuestion() {
    const en = window.prompt('Question title in English:')
    if (!en?.trim()) return
    const rawType = window.prompt('Question type: chips or text', 'chips')?.trim().toLowerCase()
    if (rawType !== 'chips' && rawType !== 'text') return
    const question: CustomReviewQuestion = {
      id: `custom_${Date.now().toString(36)}`,
      en: en.trim(),
      de: en.trim(),
      type: rawType,
      options: [],
    }
    setForm((current) => ({
      ...current,
      customQuestions: [...(current.customQuestions || []), question],
    }))
  }

  function updateCustomQuestion(id: string, patch: Partial<CustomReviewQuestion>) {
    setForm((current) => ({
      ...current,
      customQuestions: (current.customQuestions || []).map((question) =>
        question.id === id ? { ...question, ...patch } : question,
      ),
    }))
  }

  function moveCustomQuestion(id: string, dir: 'up' | 'down') {
    setForm((current) => {
      const questions = current.customQuestions || []
      const index = questions.findIndex((question) => question.id === id)
      const target = dir === 'up' ? index - 1 : index + 1
      if (index < 0 || target < 0 || target >= questions.length) return current
      const next = [...questions]
      ;[next[index], next[target]] = [next[target]!, next[index]!]
      return { ...current, customQuestions: next }
    })
  }

  function saveForm() {
    setSavingForm(true)
    setFormError('')
    void publishReviewFormConfig(form, user)
      .then((saved) => {
        setForm(saved)
        setEditMode(false)
      })
      .catch((reason: unknown) => {
        setFormError(reason instanceof Error ? reason.message : 'Could not save review form.')
      })
      .finally(() => setSavingForm(false))
  }

  function customAnswerText(): string {
    return (form.customQuestions || [])
      .flatMap((question) => {
        const answer = customAnswers[question.id]
        if (Array.isArray(answer)) {
          const labels = question.options
            .filter((option) => answer.includes(option.id))
            .map((option) => option[lang] || option.en)
          return labels.length ? [`${question[lang] || question.en}: ${labels.join(', ')}`] : []
        }
        return answer?.trim() ? [`${question[lang] || question.en}: ${answer.trim()}`] : []
      })
      .join('\n')
  }

  async function submit() {
    setError('')
    if (!overallRating) {
      setError(t.errOverall)
      return
    }
    if (!restOptional && (!foodRating || !serviceRating)) {
      setError(t.errDetails)
      return
    }

    const selectedItems = items
      .filter((id) => id !== otherId)
      .concat(itemsOther.trim() ? [itemsOther.trim()] : [])

    const draft = normalizeReview({
      id: newReviewId(),
      createdAt: new Date().toISOString(),
      name,
      overallRating,
      items: selectedItems,
      spicyOk: spicyOk || undefined,
      foodRating,
      improve: form.improve.filter((o) => improve.includes(o.id)).map((o) => o.en),
      serviceRating,
      recommend: recommend || undefined,
      wantToTry: form.wantTry.filter((o) => wantToTry.includes(o.id)).map((o) => o.en),
      wantOther,
      visitReason: form.visitReasons.filter((o) => visitReason.includes(o.id)).map((o) => o.en),
      favorites: form.favorites.filter((o) => favorites.includes(o.id)).map((o) => o.en),
      smileNote: [smileNote.trim(), customAnswerText()].filter(Boolean).join('\n'),
      lang: (() => {
        const detected = detectLanguage([smileNote, itemsOther, wantOther].join(' '))
        return detected === 'de' || detected === 'en' ? detected : lang
      })(),
    })
    if (!draft) {
      setError(t.errOverall)
      return
    }

    setBusy(true)
    appendLocalReview(draft)
    try {
      await fetch('/api/customer-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
    } catch {
      /* local copy already saved */
    }
    setBusy(false)
    setDone(draft)
  }

  const firstName = (done?.name || name).trim().split(/\s+/)[0] || t.friend

  function QuestionTools({ question }: { question: ReviewQuestionKey }) {
    if (!editMode) return null
    const order = form.questionOrder || DEFAULT_QUESTION_ORDER
    return (
      <span className="public-review__edit-tools">
        <button
          type="button"
          className="public-review__chip"
          title="Move question up"
          disabled={order.indexOf(question) === 0}
          onClick={() => moveQuestion(question, 'up')}
        >
          <ArrowUp size={14} />
        </button>
        <button
          type="button"
          className="public-review__chip"
          title="Move question down"
          disabled={order.indexOf(question) === order.length - 1}
          onClick={() => moveQuestion(question, 'down')}
        >
          <ArrowDown size={14} />
        </button>
      </span>
    )
  }

  function Panel({
    question,
    title,
    children,
  }: {
    question: ReviewQuestionKey
    title?: ReactNode
    children: ReactNode
  }) {
    return (
      <section className="public-review__panel">
        {title && (
          <div className="public-review__panel-head">
            <h2>{title}</h2>
            <QuestionTools question={question} />
          </div>
        )}
        {children}
      </section>
    )
  }

  function ChipGroup({
    listKey,
    chips,
    selected,
    onToggle,
    selectionValue = (option) => option.id,
    onChangeChips,
    onAddOption,
  }: {
    listKey: ChipListKey
    chips: ReviewChip[]
    selected: string[]
    onToggle: (id: string) => void
    selectionValue?: (option: ReviewChip) => string
    onChangeChips?: (next: ReviewChip[]) => void
    onAddOption?: () => void
  }) {
    const changeChips = onChangeChips || ((next: ReviewChip[]) => updateChipList(listKey, next))
    return (
      <div className="public-review__chips">
        {chips.map((option, index) => (
          <div className="public-review__chip-row-edit" key={option.id}>
            <button
              type="button"
              className={`public-review__chip${selected.includes(selectionValue(option)) ? ' is-active' : ''}`}
              onClick={() => onToggle(selectionValue(option))}
            >
              {option[lang] || option.en}
            </button>
            {editMode && (
              <span className="public-review__edit-tools">
                <button
                  type="button"
                  className="public-review__chip"
                  title="Move option up"
                  disabled={index === 0}
                  onClick={() => changeChips(moveChipInList(chips, option.id, 'up'))}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className="public-review__chip"
                  title="Move option down"
                  disabled={index === chips.length - 1}
                  onClick={() => changeChips(moveChipInList(chips, option.id, 'down'))}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  className="public-review__chip"
                  title="Remove option"
                  onClick={() => changeChips(chips.filter((chip) => chip.id !== option.id))}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            )}
          </div>
        ))}
        {editMode && (
          <button
            type="button"
            className="public-review__chip"
            onClick={onAddOption || (() => addChip(listKey))}
          >
            <Plus size={14} /> Add option
          </button>
        )}
      </div>
    )
  }

  function renderBuiltInQuestion(question: ReviewQuestionKey): ReactNode {
    const optional = restOptional ? ` (${t.optional})` : ''
    switch (question) {
      case 'name':
        return (
          <Panel question={question}>
            <div className="public-review__panel-head">
              <label className="public-review__field">
                <span>{t.name}</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t.namePh}
                  autoComplete="name"
                  maxLength={80}
                />
              </label>
              <QuestionTools question={question} />
            </div>
          </Panel>
        )
      case 'ate':
        return (
          <Panel question={question} title={`${t.ate}${optional}`}>
            <ChipGroup
              listKey="eatExtras"
              chips={form.eatExtras}
              selected={items}
              onToggle={(id) => setItems((previous) => toggle(previous, id))}
              selectionValue={(option) => option[lang] || option.en}
            />
            <div className="public-review__chips">
              {menuChips.map((dish) => (
                <button
                  key={dish}
                  type="button"
                  className={`public-review__chip${items.includes(dish) ? ' is-active' : ''}`}
                  onClick={() => setItems((previous) => toggle(previous, dish))}
                >
                  {dish}
                </button>
              ))}
              <button
                type="button"
                className={`public-review__chip${items.includes(otherId) ? ' is-active' : ''}`}
                onClick={() => setItems((previous) => toggle(previous, otherId))}
              >
                {t.ateOther}
              </button>
            </div>
            {showAteOther && (
              <label className="public-review__field public-review__field--optional">
                <span>{t.ateOther}</span>
                <input
                  value={itemsOther}
                  onChange={(event) => setItemsOther(event.target.value)}
                  placeholder={t.ateOtherPh}
                  maxLength={120}
                />
              </label>
            )}
          </Panel>
        )
      case 'spicy':
        return (
          <Panel question={question} title={`${t.spicy}${optional}`}>
            <ChipGroup
              listKey="spicy"
              chips={form.spicy}
              selected={spicyOk ? [spicyOk] : []}
              onToggle={setSpicyOk}
            />
          </Panel>
        )
      case 'food':
        return (
          <Panel question={question} title={`${t.food}${optional}`}>
            <StarPick value={foodRating} onChange={setFoodRating} label={t.food} labels={FOOD_RATING_LABELS[lang]} />
          </Panel>
        )
      case 'favorite':
        return (
          <Panel question={question} title={`${t.favorite}${optional}`}>
            <ChipGroup
              listKey="favorites"
              chips={form.favorites}
              selected={favorites}
              onToggle={(id) => setFavorites((previous) => toggle(previous, id))}
            />
          </Panel>
        )
      case 'improve':
        return (
          <Panel question={question} title={`${t.improve}${optional}`}>
            <ChipGroup
              listKey="improve"
              chips={form.improve}
              selected={improve}
              onToggle={(id) => setImprove((previous) => toggle(previous, id))}
            />
          </Panel>
        )
      case 'service':
        return (
          <Panel question={question} title={`${t.service}${optional}`}>
            <StarPick value={serviceRating} onChange={setServiceRating} label={t.service} labels={FOOD_RATING_LABELS[lang]} />
          </Panel>
        )
      case 'recommend':
        return (
          <Panel question={question} title={`${t.recommend}${optional}`}>
            <ChipGroup
              listKey="recommend"
              chips={form.recommend}
              selected={recommend ? [recommend] : []}
              onToggle={setRecommend}
            />
          </Panel>
        )
      case 'visit':
        return (
          <Panel question={question} title={`${t.visit}${optional}`}>
            <ChipGroup
              listKey="visitReasons"
              chips={form.visitReasons}
              selected={visitReason}
              onToggle={(id) => setVisitReason((previous) => toggle(previous, id))}
            />
          </Panel>
        )
      case 'want':
        return (
          <Panel question={question} title={`${t.want}${optional}`}>
            <ChipGroup
              listKey="wantTry"
              chips={form.wantTry}
              selected={wantToTry}
              onToggle={(id) => setWantToTry((previous) => toggle(previous, id))}
            />
            <label className="public-review__field public-review__field--optional">
              <span>{t.wantOther}</span>
              <input
                value={wantOther}
                onChange={(event) => setWantOther(event.target.value)}
                placeholder={t.wantOtherPh}
                maxLength={120}
              />
            </label>
          </Panel>
        )
      case 'smile':
        return (
          <Panel question={question} title={`${t.smile}${optional}`}>
            <label className="public-review__field">
              <input
                value={smileNote}
                onChange={(event) => setSmileNote(event.target.value)}
                placeholder={t.smilePh}
                maxLength={200}
              />
            </label>
          </Panel>
        )
    }
  }

  function renderCustomQuestion(question: CustomReviewQuestion, index: number) {
    const questions = form.customQuestions || []
    const answer = customAnswers[question.id]
    return (
      <section className="public-review__panel" key={question.id}>
        <div className="public-review__panel-head">
          <h2>{question[lang] || question.en}</h2>
          {editMode && (
            <span className="public-review__edit-tools">
              <button
                type="button"
                className="public-review__chip"
                title="Move question up"
                disabled={index === 0}
                onClick={() => moveCustomQuestion(question.id, 'up')}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                className="public-review__chip"
                title="Move question down"
                disabled={index === questions.length - 1}
                onClick={() => moveCustomQuestion(question.id, 'down')}
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                className="public-review__chip"
                title="Remove question"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    customQuestions: (current.customQuestions || []).filter((item) => item.id !== question.id),
                  }))
                }
              >
                <Trash2 size={14} />
              </button>
            </span>
          )}
        </div>
        {question.type === 'chips' ? (
          <ChipGroup
            listKey="eatExtras"
            chips={question.options}
            selected={Array.isArray(answer) ? answer : []}
            onToggle={(id) =>
              setCustomAnswers((current) => {
                const previous = current[question.id]
                const selectedIds: string[] = Array.isArray(previous) ? [...previous] : []
                return { ...current, [question.id]: toggle(selectedIds, id) }
              })
            }
            onChangeChips={(options) => updateCustomQuestion(question.id, { options })}
            onAddOption={() => {
              const en = window.prompt('Option in English:')
              if (!en?.trim()) return
              const de = window.prompt('Option in German (leave empty to use English):')?.trim() || en.trim()
              updateCustomQuestion(question.id, {
                options: [...question.options, newReviewChip(en.trim(), de)],
              })
            }}
          />
        ) : (
          <label className="public-review__field">
            <input
              value={typeof answer === 'string' ? answer : ''}
              onChange={(event) =>
                setCustomAnswers((current) => ({ ...current, [question.id]: event.target.value }))
              }
              maxLength={200}
            />
          </label>
        )}
      </section>
    )
  }

  return (
    <div className={`public-review${done ? ' is-done' : ''}`} data-theme="light" lang={lang}>
      <div className="public-review__bg" aria-hidden>
        <span className="public-review__bg-glow public-review__bg-glow--a" />
        <span className="public-review__bg-glow public-review__bg-glow--b" />
        <span className="public-review__bg-pattern" />
      </div>

      <main className="public-review__shell">
        <header className="public-review__hero">
          <div className="public-review__hero-top">
            <div className="public-review__lang" role="group" aria-label="Language">
              <button
                type="button"
                className={lang === 'de' ? 'is-active' : ''}
                onClick={() => switchLang('de')}
              >
                DE
              </button>
              <button
                type="button"
                className={lang === 'en' ? 'is-active' : ''}
                onClick={() => switchLang('en')}
              >
                EN
              </button>
            </div>
          </div>
          <div className="public-review__brand">
            <img
              className="public-review__logo"
              src="/nasta-logo.png"
              alt=""
              width={64}
              height={64}
            />
            <h1 className="public-review__brand-name">{brandName}</h1>
            <p className="public-review__title">
              {done ? t.thanksTitle(firstName) : t.title}
            </p>
            {!done && <p className="public-review__sub">{t.sub}</p>}
          </div>
        </header>

        {done ? (
          <section className="public-review__thanks" role="status">
            <div className="public-review__check">
              <Check size={28} aria-hidden />
            </div>
            <p className="public-review__thanks-msg">{thankYouMessage(done, lang)}</p>
            <Link className="public-review__btn public-review__btn--ghost" to="/order">
              {lang === 'de' ? 'Zurück zum Menü' : 'Back to menu'}
            </Link>
          </section>
        ) : (
          <div className="public-review__form">
            {staffCanEdit && (
              <div className="public-review__staff-bar">
                <span>Staff tools</span>
                <button
                  type="button"
                  className="public-review__chip"
                  onClick={() => {
                    setEditMode((current) => !current)
                    setFormError('')
                  }}
                >
                  <Pencil size={14} /> {editMode ? 'Done editing' : 'Edit form'}
                </button>
                {editMode && (
                  <>
                    <button
                      type="button"
                      className="public-review__chip"
                      disabled={savingForm}
                      onClick={saveForm}
                    >
                      {savingForm ? 'Saving…' : 'Save form'}
                    </button>
                    <button type="button" className="public-review__chip" onClick={addCustomQuestion}>
                      <Plus size={14} /> Add question
                    </button>
                  </>
                )}
              </div>
            )}
            {formError && <p className="public-review__error">{formError}</p>}
            <section className="public-review__panel public-review__overall">
              <h2>{t.overall}</h2>
              <StarPick
                value={overallRating}
                onChange={setOverallRating}
                label={t.overall}
                labels={FOOD_RATING_LABELS[lang]}
              />
              {restOptional && (
                <p className="public-review__optional-hint">{t.optionalHint}</p>
              )}
            </section>

            {overallRating > 0 && (
              <>
                {(form.questionOrder || DEFAULT_QUESTION_ORDER).map((question) => (
                  <div key={question}>{renderBuiltInQuestion(question)}</div>
                ))}
                {(form.customQuestions || []).map(renderCustomQuestion)}
              </>
            )}

            {error && <p className="public-review__error">{error}</p>}

            <button
              type="button"
              className={`public-review__btn public-review__btn--block${busy ? ' action-morph is-busy' : ''}`}
              disabled={busy || !overallRating}
              onClick={() => void submit()}
            >
              {busy ? t.sending : t.send}
            </button>
          </div>
        )}

        <footer className="public-review__foot">
          <Link to="/order">{lang === 'de' ? 'Zum Bestellen' : 'Order food'}</Link>
        </footer>
      </main>
    </div>
  )
}
