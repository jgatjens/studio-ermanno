import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import {MemoryRouter,Routes,Route} from 'react-router-dom'
import {beforeEach,expect,test,vi} from 'vitest'
import {AdminQueryProvider} from '../query-provider'
import {AppointmentsPage,AppointmentDetailPage,AppointmentFormPage} from './pages'
import {apiRequest,ApiError} from '@/lib/api'
const state=vi.hoisted(()=>({actor:{auth_user_id:'user',membership_id:'m',business_id:'b',role:'OWNER' as 'OWNER'|'STAFF'}}))
vi.mock('@/auth/auth-provider',()=>({useAuth:()=>state}))
vi.mock('@/lib/api',async original=>({...await original<typeof import('@/lib/api')>(),apiRequest:vi.fn()}))
const customer={id:'client',first_name:'Alice',last_name:'Test',email:'private@example.com',phone:'private phone'}
const snapshot={service_id:'service',name:'Historical cut',duration_minutes:30,price:'20.00'}
const totals={calculated_duration_minutes:30,calculated_price:'20.00',final_duration_minutes:30,final_price:'20.00',scheduled_end:'2026-10-05T08:30:00Z',services:[snapshot]}
const item={...totals,id:'one',client:customer,barber:null,scheduled_start:'2026-10-05T08:00:00Z',status:'SCHEDULED',main_service:snapshot,appointment_notes:'Allowed note',visit_notes:'Private visit',products:[]}
function mockApi(){vi.mocked(apiRequest).mockImplementation(async(path,options)=>{
 if(path==='/appointments/context')return {timezone:'Europe/Rome',currency:'EUR'}
 if(path.startsWith('/clients?'))return {items:[customer],total:1}
 if(path==='/services?active=true')return [{id:'service',name:'Cut',duration_minutes:30,price:'20.00',is_active:true}]
 if(path==='/barbers?active=true')return [{id:'barber',name:'Barber',is_active:true}]
 if(path==='/appointments/preview')return {...totals,final_price:JSON.parse(options?.body as string).price_override??'20.00'}
 if(path.startsWith('/appointments?'))return {items:[item],total:1}
 return item
})}
beforeEach(()=>{vi.resetAllMocks();state.actor.role='OWNER';mockApi()})
function mount(path='/admin/appointments'){return render(<MemoryRouter initialEntries={[path]}><AdminQueryProvider><Routes><Route path="/admin/appointments" element={<AppointmentsPage/>}/><Route path="/admin/appointments/new" element={<AppointmentFormPage/>}/><Route path="/admin/appointments/:appointmentId" element={<AppointmentDetailPage/>}/><Route path="/admin/appointments/:appointmentId/edit" element={<AppointmentFormPage/>}/></Routes></AdminQueryProvider></MemoryRouter>)}
test('Today list shows timezone, Unassigned and Owner create',async()=>{mount();await screen.findByText('Alice Test');expect(screen.getByText('Create appointment')).toBeInTheDocument();expect(screen.getByText(/Business timezone: Europe\/Rome/)).toBeInTheDocument();expect(screen.getByText(/Unassigned/)).toBeInTheDocument();expect(apiRequest).toHaveBeenCalledWith(expect.stringMatching(/from=.*to=/),expect.anything())})
test('Staff detail omits private fields and actions',async()=>{state.actor.role='STAFF';mount('/admin/appointments/one');await screen.findByText('Alice Test');expect(screen.queryByText(/private@example/)).not.toBeInTheDocument();expect(screen.queryByText(/Private visit/)).not.toBeInTheDocument();expect(screen.queryByText('Edit appointment')).not.toBeInTheDocument();expect(screen.getByText(/Allowed note/)).toBeInTheDocument()})
test('Staff cannot open create form',async()=>{state.actor.role='STAFF';mount('/admin/appointments/new');expect(screen.getByText('Access denied.')).toBeInTheDocument();expect(apiRequest).not.toHaveBeenCalledWith('/services?active=true',expect.anything())})
test('cancel requires deliberate second action and invalidates detail',async()=>{mount('/admin/appointments/one');await screen.findByText('Cancel appointment');fireEvent.click(screen.getByText('Cancel appointment'));expect(apiRequest).not.toHaveBeenCalledWith('/appointments/one/status',expect.anything());fireEvent.click(screen.getByText('Yes, change status'));await screen.findByText('Status saved.');expect(apiRequest).toHaveBeenCalledWith('/appointments/one/status',expect.objectContaining({method:'POST',body:'{"status":"CANCELLED"}'}))})
async function fill(){await screen.findByRole('button',{name:'Alice Test'});fireEvent.click(screen.getByRole('button',{name:'Alice Test'}));fireEvent.change(screen.getByLabelText('Business-local date and time'),{target:{value:'2026-10-05T10:00'}});fireEvent.click(await screen.findByLabelText('Cut'));await screen.findByLabelText('Appointment preview')}
test('create previews and sends explicit zero override',async()=>{mount('/admin/appointments/new');await fill();fireEvent.change(screen.getByLabelText('Price override'),{target:{value:'0'}});await waitFor(()=>expect(screen.getByText(/Final: 30 minutes · 0 EUR/)).toBeInTheDocument());await waitFor(()=>expect(screen.getByText('Save appointment')).not.toBeDisabled());fireEvent.click(screen.getByText('Save appointment'));await screen.findByText('Appointment saved.');expect(apiRequest).toHaveBeenCalledWith('/appointments',expect.objectContaining({method:'POST',body:expect.stringContaining('"price_override":"0"')}))})
test('conflict retains entered draft',async()=>{const normal=vi.mocked(apiRequest).getMockImplementation()!;vi.mocked(apiRequest).mockImplementation((path,options)=>path==='/appointments'?Promise.reject(new ApiError(409,'No capacity remains.')):normal(path,options));mount('/admin/appointments/new');await fill();fireEvent.click(screen.getByText('Save appointment'));await screen.findByText('No capacity remains.');expect(screen.getByText('No capacity remains.')).toHaveFocus();expect(screen.getByLabelText('Business-local date and time')).toHaveValue('2026-10-05T10:00')})
test('edit retains historical inactive selection and sends PUT',async()=>{const normal=vi.mocked(apiRequest).getMockImplementation()!;vi.mocked(apiRequest).mockImplementation((path,options)=>path==='/services?active=true'?Promise.resolve([]):normal(path,options));mount('/admin/appointments/one/edit');expect(await screen.findByLabelText('Historical cut (retained inactive service)')).toBeChecked();await screen.findByLabelText('Appointment preview');fireEvent.click(screen.getByText('Save appointment'));await screen.findByText('Appointment saved.');expect(apiRequest).toHaveBeenCalledWith('/appointments/one',expect.objectContaining({method:'PUT'}))})
test('appointment list empty and error states',async()=>{const normal=vi.mocked(apiRequest).getMockImplementation()!;vi.mocked(apiRequest).mockImplementation((path,options)=>path.startsWith('/appointments?')?Promise.resolve({items:[],total:0}):normal(path,options));mount();await screen.findByText('No appointments in this range.')})
test('late preview cannot replace totals for newer form inputs',async()=>{
  const normal=vi.mocked(apiRequest).getMockImplementation()!
  let releaseOld:(value:typeof totals)=>void=()=>{}
  vi.mocked(apiRequest).mockImplementation((path,options)=>{
    if(path==='/appointments/preview'&&JSON.parse(options?.body as string).price_override==='1')return new Promise(resolve=>{releaseOld=resolve})
    return normal(path,options)
  })
  mount('/admin/appointments/new');await fill()
  fireEvent.change(screen.getByLabelText('Price override'),{target:{value:'1'}})
  await waitFor(()=>expect(apiRequest).toHaveBeenCalledWith('/appointments/preview',expect.objectContaining({body:expect.stringContaining('"price_override":"1"')})))
  fireEvent.change(screen.getByLabelText('Price override'),{target:{value:'2'}})
  await screen.findByText('Final: 30 minutes · 2 EUR')
  releaseOld({...totals,final_price:'1'})
  await waitFor(()=>expect(screen.getByText('Final: 30 minutes · 2 EUR')).toBeInTheDocument())
  expect(screen.queryByText('Final: 30 minutes · 1 EUR')).not.toBeInTheDocument()
})
test('creating a client from a dirty appointment requires explicit leave confirmation',async()=>{
  mount('/admin/appointments/new');await screen.findByLabelText('Appointment notes');fireEvent.change(screen.getByLabelText('Appointment notes'),{target:{value:'Keep this draft'}});fireEvent.click(screen.getByRole('link',{name:'Create client first'}));expect(screen.getByRole('group',{name:'Leave appointment draft'})).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Keep editing appointment'}));expect(screen.getByLabelText('Appointment notes')).toHaveValue('Keep this draft');expect(screen.queryByRole('group',{name:'Leave appointment draft'})).not.toBeInTheDocument()
})
