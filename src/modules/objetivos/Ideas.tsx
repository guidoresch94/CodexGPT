import { PiggyBank, Target, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { AppData } from '../../db/hooks'
import { db } from '../../db/schema'
import { money0, parseAmount, uid } from '../../lib/format'
import type { Idea, IdeaStatus, IdeaTag } from '../../types'
import { useToast } from '../../components/Toast'
import { Button, Card, cx, Empty, Input, SectionTitle } from '../../components/ui'

const TAGS: { value: IdeaTag; label: string }[] = [
  { value: 'casa', label: '🏠 Casa' },
  { value: 'viaje', label: '✈️ Viaje' },
  { value: 'proyecto', label: '🛠️ Proyecto' },
  { value: 'compra', label: '🛍️ Compra' },
  { value: 'aprendizaje', label: '🎓 Aprender' },
  { value: 'otro', label: '✨ Otro' },
]
const tagLabel = (t: IdeaTag) => TAGS.find((x) => x.value === t)?.label ?? t
const tagIcon = (t: IdeaTag) => tagLabel(t).split(' ')[0]

export function Ideas({ data }: { data: AppData }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [tag, setTag] = useState<IdeaTag>('casa')
  const [cost, setCost] = useState('')
  const [showOld, setShowOld] = useState(false)

  const open = data.ideas.filter((i) => i.status === 'nueva' || i.status === 'evaluando')
  const closed = data.ideas.filter((i) => i.status === 'convertida' || i.status === 'descartada')

  const add = async () => {
    if (!text.trim()) return
    await db.ideas.put({ id: uid(), text: text.trim(), tag, status: 'nueva', cost: parseAmount(cost) || undefined, createdAt: Date.now() })
    setText('')
    setCost('')
    toast({ text: '💡 Idea guardada' })
  }

  const setStatus = (i: Idea, status: IdeaStatus) => db.ideas.update(i.id, { status })

  const toGoal = async (i: Idea) => {
    await db.goals.put({ id: uid(), title: i.text, icon: tagIcon(i.tag), area: i.tag === 'aprendizaje' ? 'Aprendizaje' : i.tag === 'casa' ? 'Casa' : 'Social', status: 'activo', createdAt: Date.now() })
    await setStatus(i, 'convertida')
    toast({ text: '🎯 Convertida en objetivo (en la pestaña Objetivos)' })
  }
  const toFund = async (i: Idea) => {
    await db.funds.put({ id: uid(), name: i.text.slice(0, 40), icon: tagIcon(i.tag), color: '#a78bfa', target: i.cost, initialBalance: 0, archived: false, order: data.funds.length })
    await setStatus(i, 'convertida')
    toast({ text: '🐷 Convertida en ahorro (en la pestaña Ahorros)' })
  }

  return (
    <div>
      <Card className="space-y-3">
        <Input
          placeholder="Anotá una idea antes de que se te escape…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          className="text-base"
        />
        <div className="flex flex-wrap gap-1.5">
          {TAGS.map((t) => (
            <button key={t.value} onClick={() => setTag(t.value)} className={cx('rounded-full px-2.5 py-1 text-xs', tag === t.value ? 'bg-accent text-white' : 'bg-ios-fill')}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input inputMode="decimal" placeholder="Coste aprox. € (opcional)" value={cost} onChange={(e) => setCost(e.target.value)} />
          <Button disabled={!text.trim()} onClick={add}>Guardar</Button>
        </div>
      </Card>

      {open.length === 0 ? (
        <Empty icon="💡" text="Sin ideas pendientes. Anotá acá lo que se te ocurra y decidí después." />
      ) : (
        <div className="mt-4 space-y-2">
          {open.map((i) => (
            <Card key={i.id} className="p-3.5">
              <div className="flex items-start gap-3">
                <span className="text-xl">{tagIcon(i.tag)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{i.text}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {tagLabel(i.tag).split(' ').slice(1).join(' ')}
                    {i.cost ? ` · ~${money0(i.cost)}` : ''}
                    {' · '}
                    <button onClick={() => setStatus(i, i.status === 'nueva' ? 'evaluando' : 'nueva')} className={cx('font-medium', i.status === 'evaluando' ? 'text-amber-600 dark:text-amber-400' : 'text-sky-600 dark:text-sky-400')}>
                      {i.status === 'evaluando' ? 'evaluando' : 'nueva'}
                    </button>
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => toGoal(i)} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-ios-fill py-2 text-xs">
                  <Target size={13} /> Objetivo
                </button>
                <button onClick={() => toFund(i)} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-ios-fill py-2 text-xs">
                  <PiggyBank size={13} /> Ahorro
                </button>
                <button onClick={() => setStatus(i, 'descartada')} className="flex items-center justify-center gap-1 rounded-xl bg-ios-fill px-3 py-2 text-xs text-slate-500" aria-label="Descartar">
                  <X size={13} /> Descartar
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {closed.length > 0 && (
        <>
          <SectionTitle action={<button onClick={() => setShowOld(!showOld)} className="text-[13px] text-accent">{showOld ? 'Ocultar' : 'Ver'}</button>}>
            Archivadas ({closed.length})
          </SectionTitle>
          {showOld && (
            <Card className="divide-y divide-slate-100 p-0 dark:divide-white/5">
              {closed.map((i) => (
                <div key={i.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className={cx('flex-1', i.status === 'descartada' && 'line-through opacity-60')}>{i.text}</span>
                  <span className="text-[11px] text-slate-500">{i.status}</span>
                  <button onClick={() => db.ideas.delete(i.id)} className="text-slate-400 hover:text-red-500" aria-label="Borrar idea">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
