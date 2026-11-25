// Small helper so forms stay readable.
export default function SelectField({ name, labelText, options, defaultValue, hint, full, placeholder, required }) {
  return (
    <div className={`adm-field${full ? " full" : ""}`}>
      <label htmlFor={name}>{labelText}</label>
      <select id={name} name={name} defaultValue={defaultValue ?? ""} required={required}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <small>{hint}</small>}
    </div>
  );
}
