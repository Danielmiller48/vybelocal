import { useState, useEffect, Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronDown } from 'lucide-react';

// DateTimeSelect – separate date and 30-minute time dropdown, returns ISO string (local)
export default function DateTimeSelect({ label, value, onChange, required=false }) {
  // value is assumed in ISO "yyyy-MM-ddTHH:mm" or ''
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  // sync internal state with external value (only when different)
  useEffect(() => {
    if (!value) { if(date||time){ setDate(''); setTime(''); } return; }
    const [d, tRaw] = value.split('T');
    const t = tRaw?.slice(0, 5) || '';
    if (d !== date) setDate(d);
    if (t !== time) setTime(t);
  }, [value]);

  // whenever date or time changes, propagate
  useEffect(() => {
    if(!date || !time){ return; }
    const composed = `${date}T${time}`;
    if(value!==composed) onChange(composed);
  }, [date,time,onChange]);

  // build 00:00 to 23:30 options
  const options = [];
  for(let h=0;h<24;h++){
    ['00','30'].forEach(min=>{
      options.push(`${h.toString().padStart(2,'0')}:${min}`);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <div className="flex gap-2 items-start">
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="input flex-1" required={required} />

        {/* fancy time dropdown */}
        <Listbox value={time} onChange={setTime} as="div" className="relative">
          <Listbox.Button className="input flex items-center gap-2 w-28 text-left">
            {time || 'Select…'}
            <ChevronDown className="h-4 w-4 ml-auto opacity-60" />
          </Listbox.Button>
          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <Listbox.Options className="absolute right-0 mt-1 max-h-60 w-28 overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 focus:outline-none z-20">
              {options.map((opt) => (
                <Listbox.Option
                  key={opt}
                  className={({ active }) => `cursor-pointer select-none px-3 py-1 ${active ? 'bg-indigo-600 text-white' : 'text-gray-900'}`}
                  value={opt}
                >
                  {opt}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </Listbox>
      </div>
    </div>
  );
} 