'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Comment {
  id: string
  author_name: string | null
  body: string
  created_at: string
}

interface RecordCommentsProps {
  recordId: string
  tableName: string
  orgId: string | null
}

export default function RecordComments({ recordId, tableName, orgId }: RecordCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function load() {
    if (!orgId) return
    const { data } = await supabase
      .from('record_comments')
      .select('id, author_name, body, created_at')
      .eq('record_id', recordId)
      .eq('table_name', tableName)
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })
    setComments((data as Comment[]) ?? [])
  }

  useEffect(() => { load() }, [recordId, orgId])

  async function submit() {
    if (!body.trim() || !orgId) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()

    // resolve employee name for this user
    const { data: emp } = await supabase
      .from('employees')
      .select('name')
      .eq('user_id', user?.id)
      .eq('org_id', orgId)
      .single()

    await supabase.from('record_comments').insert({
      record_id: recordId,
      table_name: tableName,
      org_id: orgId,
      author_id: user?.id ?? null,
      author_name: emp?.name ?? user?.email ?? 'Unknown',
      body: body.trim(),
    })

    setBody('')
    setSaving(false)
    load()
  }

  if (!orgId) return null

  return (
    <div className="border-t border-[#2e2016] pt-4 mt-4 space-y-3">
      <div className="text-xs font-semibold text-[#c4b49a]/50 uppercase tracking-wider">
        Comments {comments.length > 0 && <span className="text-[#c8843a]">({comments.length})</span>}
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {comments.length === 0 ? (
          <div className="text-xs text-[#c4b49a]/30 italic">No comments yet.</div>
        ) : comments.map(c => (
          <div key={c.id} className="bg-[#2e2016]/30 rounded-lg px-3 py-2">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs font-semibold text-[#c8843a]">{c.author_name ?? 'Unknown'}</span>
              <span className="text-[10px] text-[#c4b49a]/40">
                {new Date(c.created_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
            <div className="text-sm text-[#c4b49a] leading-snug">{c.body}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Add a comment…"
          className="flex-1 bg-[#1a1410] border border-[#2e2016] rounded-lg px-3 py-1.5 text-sm text-white placeholder-[#c4b49a]/30 focus:outline-none focus:border-[#c8843a] transition-colors"
        />
        <button
          onClick={submit}
          disabled={saving || !body.trim()}
          className="text-xs bg-[#c8843a]/20 text-[#c8843a] border border-[#c8843a]/30 rounded-lg px-3 py-1.5 hover:bg-[#c8843a]/30 disabled:opacity-40 transition-colors whitespace-nowrap"
        >
          {saving ? '…' : 'Post'}
        </button>
      </div>
    </div>
  )
}