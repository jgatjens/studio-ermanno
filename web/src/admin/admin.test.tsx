import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { AdminQueryProvider } from './query-provider'
import { CatalogPage } from './catalog-page'
import { HoursPage } from './hours-page'
import { apiRequest } from '@/lib/api'

const state = vi.hoisted(() => ({ actor: { auth_user_id:'user',membership_id:'membership',business_id:'business',role:'OWNER' as 'OWNER'|'STAFF' } }))
vi.mock('@/auth/auth-provider',()=>({useAuth:()=>state}))
vi.mock('@/lib/api',async original=>({...await original<typeof import('@/lib/api')>(),apiRequest:vi.fn()}))
const haircut={id:'one',name:'Haircut',is_active:true,description:null,duration_minutes:30,price:'25.00'}
beforeEach(()=>{vi.resetAllMocks();state.actor={auth_user_id:'user',membership_id:'membership',business_id:'business',role:'OWNER'};vi.mocked(apiRequest).mockResolvedValue([haircut])})
function mount(){return render(<AdminQueryProvider><CatalogPage resource="services" /></AdminQueryProvider>)}

test('Owner sees catalog and edit controls',async()=>{mount();expect(await screen.findByText('Haircut')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Edit Haircut'})).toBeInTheDocument();expect(screen.getByLabelText('Name')).toBeInTheDocument()})
test('Staff reads catalog without mutation controls',async()=>{state.actor.role='STAFF';mount();await screen.findByText('Haircut');expect(screen.queryByRole('button',{name:'Edit Haircut'})).not.toBeInTheDocument();expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()})
test('save invalidates and refetches catalog',async()=>{mount();await screen.findByText('Haircut');fireEvent.change(screen.getByLabelText('Name'),{target:{value:'Beard'}});fireEvent.click(screen.getByRole('button',{name:'Save'}));await screen.findByText('Saved.');await waitFor(()=>expect(vi.mocked(apiRequest).mock.calls.filter(call=>call[0]==='/services'&&call[1]?.method===undefined).length).toBeGreaterThan(1));expect(apiRequest).toHaveBeenCalledWith('/services',expect.objectContaining({method:'POST',body:expect.stringContaining('Beard')}))})
test('deactivate retains record and sends PUT',async()=>{mount();await screen.findByText('Haircut');fireEvent.click(screen.getByRole('button',{name:'Deactivate Haircut'}));await screen.findByText('Saved.');expect(apiRequest).toHaveBeenCalledWith('/services/one',expect.objectContaining({method:'PUT',body:expect.stringContaining('"is_active":false')}))})
test('actor change cannot reuse another actors cache',async()=>{const view=mount();await screen.findByText('Haircut');vi.mocked(apiRequest).mockResolvedValue([]);state.actor={...state.actor,auth_user_id:'other',business_id:'other-business'};view.rerender(<AdminQueryProvider><CatalogPage resource="services" /></AdminQueryProvider>);expect(await screen.findByText('No services yet.')).toBeInTheDocument();expect(screen.queryByText('Haircut')).not.toBeInTheDocument()})
test('Staff weekly schedule is read-only',async()=>{state.actor.role='STAFF';vi.mocked(apiRequest).mockResolvedValue([{day_of_week:0,is_closed:false,opening_time:'09:00:00',closing_time:'18:00:00'}]);render(<AdminQueryProvider><HoursPage /></AdminQueryProvider>);expect(await screen.findByText('09:00–18:00')).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Save week'})).not.toBeInTheDocument()})

test('Staff sees both opening periods without edit controls', async () => {
  state.actor.role = 'STAFF'
  vi.mocked(apiRequest).mockResolvedValue([{ day_of_week: 1, is_closed: false, opening_time: '08:00:00', closing_time: '19:00:00', break_start: '12:00:00', break_end: '14:00:00' }])
  render(<AdminQueryProvider><HoursPage /></AdminQueryProvider>)
  expect(await screen.findByText('08:00–12:00 · 14:00–19:00')).toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})

test('Owner saves split opening periods', async () => {
  vi.mocked(apiRequest).mockResolvedValue([{ day_of_week: 1, is_closed: false, opening_time: '08:00:00', closing_time: '19:00:00' }])
  render(<AdminQueryProvider><HoursPage /></AdminQueryProvider>)
  fireEvent.click(await screen.findByLabelText('Tuesday split opening periods'))
  fireEvent.change(screen.getByLabelText('Tuesday closes for break'), { target: { value: '12:00' } })
  fireEvent.change(screen.getByLabelText('Tuesday reopens'), { target: { value: '14:00' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save week' }))
  await screen.findByText('Saved.')
  const call = vi.mocked(apiRequest).mock.calls.find(call => call[1]?.method === 'PUT')
  expect(JSON.parse(call![1]!.body as string).days[1]).toMatchObject({ break_start: '12:00', break_end: '14:00' })
})
