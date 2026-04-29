'use client'

// src/components/RecordComments.tsx
// Real-time comment thread for any record.
// Drop this inside any detail panel — pass the record id and table name.
//
// Usage:
//   <RecordComments recordId={row.id} tableName="daily_billing_claims" orgId={orgId} />
//
// Requires the comments table in Supabase — see supabase-comments-rls.sql

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useOrgUser } from '@/lib/useOrgUser'
import { Send, MessageCircle } from 'lucide-react'

interface Comment {
  id: string
  record_id: string
  table_name: string
  org_id: string
  author_employee_id: string
  author_name: string
  body: string
  created_at: string
}

interface RecordCommentsProps {
  recordId: string
  tableName: string
  orgId: string
}

export default function RecordComments({ recordId, tableName, orgId }: RecordCommentsProps) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { employeeId, employeeName } = useOrgUser()

  const [comments, setComments]   = useState<Comment[]>([])
  const [body, setBody]           = useState('')
  const [sending, setSending]     = useState(false)
  const [loading, setLoading]     = useState(true)
  const bottomRef                 = useRef<HTMLDivElement>(null)

  // ── Initial fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!recordId || !orgId) return

    supabase
      .from('comments')
      .select('*')
      .eq('record_id', recordId)
      .eq('table_name', tableName)
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setComments(data ?? [])
        setLoading(false)
      })
  }, [recordId, tableName, orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Real-time subscription ───────────────────────────────────────────────
  useEffect(() => {
    if (!recordId || !orgId) return

    const channel = supabase
      .channel(`comments:${tableName}:${recordId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `record_id=eq.${recordId}`,
        },
        (payload) => {
          const newComment = payload.new as Comment
          setComments(prev => {
            // Avoid duplicates (optimistic insert might already be there)
            if (prev.find(c => c.id === newComment.id)) return prev
            return [...prev, newComment]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [recordId, tableName, orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll to bottom when new comment arrives ────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  // ── Send comment ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = body.trim()
    if (!trimmed || !employeeId || !orgId) return

    setSending(true)

    // Optimistic insert
    const optimistic: Comment = {
      id:                  `opt-${Date.now()}`,
      record_id:           recordId,
      table_name:          tableName,
      org_id:              orgId,
      author_employee_id:  employeeId,
      author_name:         employeeName ?? 'You',
      body:                trimmed,
      created_at:          new Date().toISOString(),
    }
    setComments(prev => [...prev, optimistic])
    setBody('')

    const { error } = await supabase.from('comments').insert({
      record_id:          recordId,
      table_name:         tableName,
      org_id:             orgId,
      author_employee_id: employeeId,
      author_name:        employeeName ?? 'Staff',
      body:               trimmed,
    })

    if (error) {
      console.error('Comment send failed:', error.message)
      // Roll back optimistic insert
      setComments(prev => prev.filter(c => c.id !== optimistic.id))
      setBody(trimmed)
    }

    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const fmtTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col border-t border-[#2e2016] mt-4">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3">
        <MessageCircle className="w-4 h-4 text-[#c8843a]" />
        <span className="text-sm font-semibold text-[#e8c07a]">
          Comments {comments.length > 0 && <span className="text-[#6b5a47] font-normal">({comments.length})</span>}
        </span>
      </div>

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto px-5 space-y-3 max-h-64 min-h-[80px]">
        {loading && (
          <p className="text-xs text-[#6b5a47] italic py-4 text-center">Loading comments…</p>
        )}
        {!loading && comments.length === 0 && (
          <p className="text-xs text-[#6b5a47] italic py-4 text-center">
            No comments yet. Be the first to leave one.
          </p>
        )}
        {comments.map(c => {
          const isMe = c.author_employee_id === employeeId
          return (
            <div key={c.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0
                ${isMe ? 'bg-[#c8843a] text-white' : 'bg-[#2e1f0f] text-[#c8843a] border border-[#3a2a1a]'}`}>
                {(c.author_name ?? '?')[0].toUpperCase()}
              </div>

              {/* Bubble */}
              <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                <div className={`flex items-center gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <span className="text-[10px] font-semibold text-[#a08060]">{c.author_name}</span>
                  <span className="text-[10px] text-[#4a3828]">{fmtTime(c.created_at)}</span>
                </div>
                <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed
                  ${isMe
                    ? 'bg-[#c8843a] text-white rounded-tr-sm'
                    : 'bg-[#261c12] border border-[#3a2a1a] text-[#c4b49a] rounded-tl-sm'
                  }`}>
                  {c.body}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-3 border-t border-[#2e2016] flex gap-2 items-end">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a comment… (Enter to send)"
          rows={2}
          className="flex-1 px-3 py-2 rounded-lg bg-[#261c12] border border-[#3a2a1a] text-sm text-[#c4b49a] placeholder-[#5a4535] focus:outline-none focus:border-[#c8843a] transition resize-none"
        />
        <button
          onClick={handleSend}
          disabled={!body.trim() || sending}
          className="p-2.5 rounded-lg bg-[#c8843a] hover:bg-[#d9944a] text-white disabled:opacity-40 transition flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}