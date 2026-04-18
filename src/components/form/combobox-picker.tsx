'use client';

import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Option = {
  value: string;
  label: string;
};

type Props = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  createLabel?: string;
  disabled?: boolean;
};

export function ComboboxPicker({
  options,
  value,
  onChange,
  placeholder = '',
  searchPlaceholder = '',
  emptyText = '',
  createLabel,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = options.find((o) => o.value === value);
  // Show the matched label, or the raw value if it's a newly-created entry
  const displayText = selected ? selected.label : value || '';
  const trimmed = search.trim();
  const isNewValue =
    trimmed.length > 0 && !options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase());

  function selectValue(v: string) {
    onChange(v);
    setOpen(false);
    setSearch('');
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          type="button"
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !displayText && 'text-text-muted')}
        >
          <span className="truncate">{displayText || placeholder}</span>
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList>
            {!isNewValue && options.length === 0 && <CommandEmpty>{emptyText}</CommandEmpty>}
            <CommandGroup>
              {options
                .filter((o) => o.label.toLowerCase().includes(trimmed.toLowerCase()))
                .map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => selectValue(option.value === value ? '' : option.value)}
                  >
                    <Check
                      className={cn(
                        'mr-2 size-3.5',
                        value === option.value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              {isNewValue && createLabel && (
                <CommandItem value={`__create__${trimmed}`} onSelect={() => selectValue(trimmed)}>
                  <Plus className="mr-2 size-3.5" />
                  {createLabel} &ldquo;{trimmed}&rdquo;
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
