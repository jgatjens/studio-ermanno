import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { apiRequest } from '@/lib/api'
import { AdminQueryProvider } from './query-provider'
import { DashboardPage, dayRange } from './dashboard'
import { App } from '@/app/app'
const state=vi.hoisted(()=>({actor:{auth_user_id:'owner',membership_id:'membership',business_id:'business',role:'OWNER' as 'OWNER'|'STAFF'},logout:vi.fn()}))
vi.mock('@/auth/auth-provider',()=>({useAuth:()=>({actor:state.actor,status:'authenticated',logout:state.logout})}))
vi.mock('@/lib/api',()=>({apiRequest:vi.fn(),getHealth:vi.fn().mockResolvedValue({status:'ok'}),ApiError:class extends Error{status=500}}))
const page={items:[],total:0,limit:25,offset:0}
function appointment(id:string,status='SCHEDULED',minutes=10) { return {id,status,scheduled_start:new Date(Date.now()+minutes*60000).toISOString(),scheduled_end:new Date(Date.now()+(minutes+30)*60000).toISOString(),client:{id:'client',first_name:'Ada',last_name:id},barber:null,main_service:{name:'Haircut'}} }
beforeEach(()=>{state.actor={auth_user_id:'owner',membership_id:'membership',business_id:'business',role:'OWNER'}; vi.mocked(apiRequest).mockReset(); vi.mocked(apiRequest).mockImplementation(async path=>path==='/appointments/context'?{timezone:'Europe/Rome',currency:'EUR'}:path.startsWith('/services')?[]:page)})
afterEach(()=>vi.useRealTimers())
function mount(path?:string) { return path ? render(<MemoryRouter initialEntries={[path]}><App/></MemoryRouter>) : render(<MemoryRouter><AdminQueryProvider><DashboardPage/></AdminQueryProvider></MemoryRouter>) }
test('business-local days span DST and differ from UTC calendar date',()=>{
  const spring=dayRange(new Date('2026-03-29T12:00Z'),'Europe/Rome'),fall=dayRange(new Date('2026-10-25T12:00Z'),'Europe/Rome')
  expect(Date.parse(spring.end)-Date.parse(spring.start)).toBe(23*3600000);expect(Date.parse(fall.end)-Date.parse(fall.start)).toBe(25*3600000)
  expect(dayRange(new Date('2026-10-04T23:30Z'),'Europe/Rome').date).toBe('2026-10-05')
  expect(()=>dayRange(new Date(),'not/a-zone')).toThrow()
})
test('dashboard follows hierarchy, independent empty states and Owner shortcuts',async()=>{
  mount();await screen.findByText('No upcoming appointments today.'); expect(screen.getAllByRole('heading',{level:2}).map(h=>h.textContent)).toEqual(['Next appointment',"Today's appointments",'Appointment alerts','Low stock','Pending feedback'])
  expect(screen.getByText('Stock levels look good.')).toBeInTheDocument();expect(screen.getByText('No pending feedback.')).toBeInTheDocument();expect(screen.getByRole('link',{name:'Create appointment'})).toHaveAttribute('href','/admin/appointments/new')
  const calls=vi.mocked(apiRequest).mock.calls.filter(([path])=>path.includes('status='));expect(calls.map(([path])=>new URLSearchParams(path.split('?')[1]).get('status'))).toEqual(expect.arrayContaining(['SCHEDULED','CONFIRMED','PENDING']))
})
test('next chooses earliest active server-filtered candidate beyond a terminal list page',async()=>{
  vi.mocked(apiRequest).mockImplementation(async path=>path==='/appointments/context'?{timezone:'UTC',currency:'EUR'}:path.includes('status=SCHEDULED')?{...page,items:[appointment('later','SCHEDULED',20)]}:path.includes('status=CONFIRMED')?{...page,items:[appointment('earlier','CONFIRMED',10)]}:path.startsWith('/appointments?')?{...page,items:[appointment('done','COMPLETED',-50)],total:40}:page)
  mount();await screen.findByText('Ada earlier');expect(screen.queryByText('Ada later')).not.toBeInTheDocument();expect(screen.getByText('Showing 1–1 of 40')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Next'}));await waitFor(()=>expect(vi.mocked(apiRequest).mock.calls.some(([p])=>p.includes('offset=25'))).toBe(true))
})
test('ongoing appointments say in progress; alerts accurately describe the visible page',async()=>{
  vi.mocked(apiRequest).mockImplementation(async path=>path==='/appointments/context'?{timezone:'UTC',currency:'EUR'}:path.includes('status=CONFIRMED')?page:path.startsWith('/appointments?')?{...page,items:[appointment('ongoing','SCHEDULED',-5)],total:30}:page)
  mount();await screen.findAllByText(/In progress/);expect(screen.getByText('Unassigned active appointments on this schedule page.')).toBeInTheDocument()
})
test('Staff sees operational summaries without mutations or private fields',async()=>{
  state.actor.role='STAFF';vi.mocked(apiRequest).mockImplementation(async path=>path==='/appointments/context'?{timezone:'UTC',currency:'EUR'}:path.startsWith('/products?')?{...page,items:[{id:'p',name:'Pomade',current_stock:'2.000',minimum_stock:'5.000'}],total:8}:path.startsWith('/feedback?')?{...page,total:12}:page)
  mount();await screen.findByText('8 active low-stock products');expect(screen.getByText('12 feedback items awaiting review.')).toBeInTheDocument();expect(screen.queryByRole('link',{name:'Update stock'})).not.toBeInTheDocument();expect(screen.queryByRole('link',{name:'Create appointment'})).not.toBeInTheDocument();expect(screen.getByRole('link',{name:'View feedback'})).toBeInTheDocument()
})
test('failed timezone does not block stock or feedback; next partial failure is an error',async()=>{
  vi.mocked(apiRequest).mockImplementation(async path=>{if(path==='/appointments/context')throw Error('database secret');return page});mount();await screen.findByText('Stock levels look good.');await screen.findByText('Could not load business timezone.',{}, {timeout:3000});expect(screen.queryByText('database secret')).not.toBeInTheDocument()
})
test('one failed next status does not claim an empty or complete next appointment',async()=>{
  vi.mocked(apiRequest).mockImplementation(async path=>{if(path==='/appointments/context')return {timezone:'UTC',currency:'EUR'};if(path.includes('status=CONFIRMED'))throw Error('offline');return page});mount();await screen.findByText('Could not load the next appointment.',{}, {timeout:3000});expect(screen.queryByText('No upcoming appointments today.')).not.toBeInTheDocument();expect(screen.getByText('Stock levels look good.')).toBeInTheDocument()
})
test('shell parent navigation, More, focus and single logout preserve protected layout',async()=>{
  mount('/admin/more');expect(screen.getByRole('link',{name:'More'})).toHaveClass('active');expect(screen.getByRole('main')).toHaveFocus();fireEvent.click(screen.getAllByRole('link',{name:'Services'}).find(link => link.closest('main'))!);await screen.findByText('No services yet.');expect(screen.getByRole('link',{name:'More'})).toHaveClass('active');expect(screen.getByRole('link',{name:'More'})).toHaveAttribute('aria-current','page');expect(screen.getAllByRole('button',{name:'Logout'})).toHaveLength(1)
})
test('clock refreshes after local midnight and cleans up timers',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-04T21:59:30Z'));const view=mount();await act(async()=>{await vi.advanceTimersByTimeAsync(1)});expect(screen.getByText(/2026-10-04 · 23:59/)).toBeInTheDocument();await act(async()=>{await vi.advanceTimersByTimeAsync(60_000)});expect(screen.getByText(/2026-10-05 · 00:00/)).toBeInTheDocument();view.unmount();const calls=vi.mocked(apiRequest).mock.calls.length;await act(async()=>{await vi.advanceTimersByTimeAsync(60_000)});expect(vi.mocked(apiRequest).mock.calls).toHaveLength(calls)
})
test('manual refresh refetches the schedule as well as independent summaries',async()=>{
  mount();await screen.findByText('No appointments today.');const count=vi.mocked(apiRequest).mock.calls.filter(([p])=>p.startsWith('/appointments?')).length;fireEvent.click(screen.getByRole('button',{name:'Refresh dashboard'}));await waitFor(()=>expect(vi.mocked(apiRequest).mock.calls.filter(([p])=>p.startsWith('/appointments?')).length).toBeGreaterThan(count))
})

test('actor-scoped context cache survives child route navigation',async()=>{
  mount('/admin');await screen.findByText('No appointments today.');fireEvent.click(screen.getByRole('link',{name:'More'}));fireEvent.click(screen.getAllByRole('link',{name:'Dashboard'})[0]);await screen.findByText('No appointments today.');expect(vi.mocked(apiRequest).mock.calls.filter(([p])=>p==='/appointments/context')).toHaveLength(1)
})
test('changed actor does not retain the prior dashboard cache or Owner controls',async()=>{
  vi.mocked(apiRequest).mockImplementation(async path=>path==='/appointments/context'?{timezone:'UTC',currency:'EUR'}:path.startsWith('/products?')?{...page,items:[{id:'old',name:'Previous actor product',current_stock:'1',minimum_stock:'2'}],total:1}:page)
  const view=mount('/admin');await screen.findByText('Previous actor product');state.actor={...state.actor,auth_user_id:'staff',business_id:'other-business',role:'STAFF'};vi.mocked(apiRequest).mockImplementation(async path=>path==='/appointments/context'?{timezone:'UTC',currency:'EUR'}:page);view.rerender(<MemoryRouter initialEntries={['/admin']}><App/></MemoryRouter>);await screen.findByText('Stock levels look good.');expect(screen.queryByText('Previous actor product')).not.toBeInTheDocument();expect(screen.queryByRole('link',{name:'Create appointment'})).not.toBeInTheDocument()
})
test('returning to a visible tab updates the date without background clock requests',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-04T21:59:30Z'));const view=mount();await act(async()=>{await vi.advanceTimersByTimeAsync(1)});Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});vi.setSystemTime(new Date('2026-10-04T22:01:00Z'));await act(async()=>{await vi.advanceTimersByTimeAsync(60_000)});expect(screen.getByText(/2026-10-04 · 23:59/)).toBeInTheDocument();Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});await act(async()=>{document.dispatchEvent(new Event('visibilitychange'));await vi.advanceTimersByTimeAsync(1)});expect(screen.getByText(/2026-10-05 · 00:02/)).toBeInTheDocument();view.unmount()
})
test('invalid date context fails safely without requests using guessed dates',async()=>{
  vi.mocked(apiRequest).mockImplementation(async path=>path==='/appointments/context'?{timezone:'not/a-zone',currency:'EUR'}:page);mount();await screen.findByText('The business-local date could not be resolved. Check timezone configuration.');expect(screen.getByText('Stock levels look good.')).toBeInTheDocument();expect(vi.mocked(apiRequest).mock.calls.some(([p])=>p.startsWith('/appointments?'))).toBe(false)
})
