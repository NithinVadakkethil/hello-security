import React, { forwardRef } from 'react';

// FormInput Component
interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, type = 'text', ...props }, ref) => {
    return (
      <div className="form-group">
        <label className="form-label">{label}</label>
        <input ref={ref} type={type} className="form-input" {...props} />
        {error && <span className="form-error-msg">{error}</span>}
      </div>
    );
  }
);
FormInput.displayName = 'FormInput';

// Select Component
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string | number; label: string }[];
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, ...props }, ref) => {
    return (
      <div className="form-group">
        <label className="form-label">{label}</label>
        <select ref={ref} className="form-input" {...props}>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span className="form-error-msg">{error}</span>}
      </div>
    );
  }
);
Select.displayName = 'Select';

// Switch Component
interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, checked, onChange, ...props }, ref) => {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
        <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
        <label className="switch-toggle">
          <input
            ref={ref}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            style={{ display: 'none' }}
            {...props}
          />
          <span className="slider"></span>
        </label>
        <style jsx>{`
          .switch-toggle {
            position: relative;
            display: inline-block;
            width: 44px;
            height: 24px;
          }
          .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: var(--border-color);
            transition: .4s;
            border-radius: 24px;
          }
          .slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
          }
          input:checked + .slider {
            background-color: var(--primary);
          }
          input:checked + .slider:before {
            transform: translateX(20px);
          }
        `}</style>
      </div>
    );
  }
);
Switch.displayName = 'Switch';
