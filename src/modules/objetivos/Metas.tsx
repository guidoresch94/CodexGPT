import { useState } from 'react'
import type { AppData } from '../../db/hooks'
import { PageHeader, Segmented } from '../../components/ui'
import { Huchas } from './Huchas'
import { Ideas } from './Ideas'
import { Objetivos } from './Objetivos'

type Tab = 'objetivos' | 'huchas' | 'ideas'

export function Metas({ data, tab: initialTab }: { data: AppData; tab?: string }) {
  const [tab, setTab] = useState<Tab>(initialTab === 'huchas' || initialTab === 'ideas' ? initialTab : 'objetivos')
  const pendingIdeas = data.ideas.filter((i) => i.status === 'nueva' || i.status === 'evaluando').length
  return (
    <div>
      <PageHeader title="Metas" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'objetivos', label: '🎯 Objetivos' },
          { value: 'huchas', label: '🐷 Huchas' },
          { value: 'ideas', label: `💡 Ideas${pendingIdeas ? ` (${pendingIdeas})` : ''}` },
        ]}
      />
      <div className="mt-4">
        {tab === 'objetivos' && <Objetivos data={data} />}
        {tab === 'huchas' && <Huchas data={data} />}
        {tab === 'ideas' && <Ideas data={data} />}
      </div>
    </div>
  )
}
