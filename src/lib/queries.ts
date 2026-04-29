import { createClient } from '@/lib/supabase'

const supabase = createClient()

export async function fetchBillingRecords() {
  const { data, error } = await supabase
    .from('daily_billing_claims')
    .select('*, employees(full_name)')
    .order('date', { ascending: false })
    .limit(50)
  if (error) throw error
  return data
}

export async function fetchWeeklyReports() {
  const { data, error } = await supabase
    .from('weekly_financial_reports')
    .select('*, employees(full_name)')
    .order('week_start', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchDailyTracker() {
  const { data, error } = await supabase
    .from('daily_tracker')
    .select('*, employees(full_name)')
    .order('date', { ascending: false })
    .limit(50)
  if (error) throw error
  return data
}

export async function fetchTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, employees(full_name), projects(project_name)')
    .order('due_date', { ascending: true })
  if (error) throw error
  return data
}

export async function fetchProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*, employees(full_name)')
    .order('timeline_start', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchIssues() {
  const { data, error } = await supabase
    .from('issues_breakdowns')
    .select('*, employees(full_name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchHuddleLogs() {
  const { data, error } = await supabase
    .from('daily_huddle_log')
    .select('*')
    .order('date', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchIdeas() {
  const { data, error } = await supabase
    .from('ideas')
    .select('*, employees(full_name)')
    .order('date_added', { ascending: false })
  if (error) throw error
  return data
}