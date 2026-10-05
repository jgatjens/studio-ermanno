import {expect,test} from 'vitest'
import {localStamp,timeChoices,toInstant,nextDate} from './time'
test('business-local conversion is independent from browser zone',()=>{expect(toInstant('2026-10-05T10:00','Europe/Rome')).toBe('2026-10-05T08:00:00.000Z');expect(localStamp('2026-10-05T08:00:00Z','Europe/Rome')).toBe('2026-10-05T10:00')})
test('DST gap is rejected',()=>{expect(timeChoices('2026-03-29T02:30','Europe/Rome')).toEqual([]);expect(()=>toInstant('2026-03-29T02:30','Europe/Rome')).toThrow(/does not exist/)})
test('DST repeated time requires explicit offset',()=>{expect(timeChoices('2026-10-25T02:30','Europe/Rome')).toHaveLength(2);expect(()=>toInstant('2026-10-25T02:30','Europe/Rome')).toThrow(/explicit UTC offset/);expect(toInstant('2026-10-25T02:30','Europe/Rome','+01:00')).toBe('2026-10-25T01:30:00.000Z')})
test('date boundary and invalid dates',()=>{expect(nextDate('2026-12-31')).toBe('2027-01-01');expect(timeChoices('2026-02-30T10:00','UTC')).toEqual([])})
