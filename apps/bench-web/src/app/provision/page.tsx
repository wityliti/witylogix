import { provisionTenant } from "./actions";

export default function ProvisionPage() {
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold mb-1">Provision a tenant</h1>
      <p className="text-gray-500 text-sm mb-8">
        Creates an Organization + TenantConfig via{" "}
        <code className="font-mono">POST /internal/bench/tenants</code>.
      </p>

      <form action={provisionTenant} className="space-y-4">
        <Field label="Slug" name="slug" placeholder="acme" required hint="lowercase letters, digits, -" />
        <Field label="Owner email" name="ownerEmail" type="email" placeholder="ops@acme.example" required />
        <Field label="Owner name" name="ownerName" placeholder="Ada Lovelace" required />
        <SelectField label="Plan" name="plan" options={["starter", "pro", "enterprise"]} />

        <div className="pt-4">
          <button
            type="submit"
            className="bg-white text-black px-4 py-2 rounded text-sm font-medium hover:bg-gray-200 transition"
          >
            Create tenant
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
        {label}
      </div>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="w-full bg-[#14141f] border border-gray-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-600"
      />
      {hint && <div className="text-xs text-gray-600 mt-1">{hint}</div>}
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: string[];
}) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
        {label}
      </div>
      <select
        name={name}
        defaultValue={options[0]}
        className="w-full bg-[#14141f] border border-gray-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-600"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
