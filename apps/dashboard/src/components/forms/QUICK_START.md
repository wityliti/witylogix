# Form Components - Quick Start Guide

## Installation & Imports

All form components are available in a single barrel export:

```tsx
import { useForm, useFieldArray } from "@/hooks";
import {
  FormField,
  FormInput,
  FormTextarea,
  FormSelect,
  FormCheckbox,
  FormCheckboxGroup,
  FormRadio,
  FormRadioGroup,
  FormFileUpload,
} from "@/components/forms";
import { emailSchema, passwordSchema } from "@/lib/validation-schemas";
```

## Basic Form Setup

```tsx
const form = useForm({
  initialValues: {
    email: "",
    password: "",
    rememberMe: false,
  },
  validationSchema: (values) => {
    const errors: Record<string, string> = {};
    if (!values.email) errors.email = "Email required";
    if (!values.password) errors.password = "Password required";
    return Object.keys(errors).length ? errors : null;
  },
  onSubmit: async (values) => {
    await api.login(values);
  },
});

return <form onSubmit={form.handleSubmit}>{/* Form fields here */}</form>;
```

## Field Registration

Register fields to automatically connect to form state:

```tsx
const emailField = form.register("email");

// Returns object with:
// - value: current value
// - onChange: handler function
// - onBlur: blur handler
// - error: error message
// - touched: whether field was interacted with
// - isDirty: whether value changed

<FormInput {...emailField} type="email" />;
```

## FormField Wrapper

Always wrap inputs with FormField for consistent styling:

```tsx
<FormField
  label="Email Address"
  required
  error={form.errors.email}
  helperText="We'll send a confirmation to this email"
>
  <FormInput
    {...form.register("email")}
    type="email"
    placeholder="you@example.com"
  />
</FormField>
```

## Text Inputs

### Basic Text Input

```tsx
<FormInput {...form.register("username")} placeholder="Enter username" />
```

### Email Input

```tsx
<FormInput
  {...form.register("email")}
  type="email"
  placeholder="your@email.com"
  prefix={<Mail size={18} />}
/>
```

### Password Input

```tsx
<FormInput
  {...form.register("password")}
  type="password"
  placeholder="Enter password"
/>
```

### Number Input with Formatting

```tsx
<FormInput
  {...form.register("phone")}
  type="tel"
  autoFormat="phone"
  placeholder="(555) 555-5555"
/>
```

### With Clear Button

```tsx
<FormInput
  {...form.register("search")}
  showClear
  onClear={() => form.setFieldValue("search", "")}
/>
```

### Debounced Search

```tsx
<FormInput
  {...form.register("searchQuery")}
  debounceMs={300}
  placeholder="Search..."
/>
```

## Textarea

```tsx
<FormField label="Message" required error={form.errors.message}>
  <FormTextarea
    {...form.register("message")}
    maxLength={500}
    showCharacterCount
    showWordCount
    autoResize
    placeholder="Your message..."
  />
</FormField>
```

## Select / Dropdown

### Simple Select

```tsx
<FormField label="Category">
  <FormSelect
    {...form.register("category")}
    options={[
      { value: "support", label: "Support" },
      { value: "feedback", label: "Feedback" },
      { value: "bug", label: "Bug Report" },
    ]}
    placeholder="Choose category..."
  />
</FormField>
```

### Multi-Select

```tsx
<FormSelect
  {...form.register("tags")}
  options={[
    { value: "react", label: "React" },
    { value: "typescript", label: "TypeScript" },
    { value: "tailwind", label: "Tailwind" },
  ]}
  isMulti
  isClearable
  isSearchable
  placeholder="Select technologies..."
/>
```

### Grouped Options

```tsx
<FormSelect
  {...form.register("tool")}
  options={[
    { value: "react", label: "React", group: "Frontend" },
    { value: "vue", label: "Vue", group: "Frontend" },
    { value: "node", label: "Node.js", group: "Backend" },
    { value: "python", label: "Python", group: "Backend" },
  ]}
/>
```

### Async Options

```tsx
<FormSelect
  {...form.register("user")}
  isSearchable
  loadOptions={async (searchTerm) => {
    const res = await fetch(`/api/users?q=${searchTerm}`);
    return res.json();
  }}
  loadingText="Searching users..."
/>
```

## Checkboxes

### Single Checkbox

```tsx
<FormCheckbox {...form.register("agree")} label="I agree to the terms" />
```

### Checkbox Group

```tsx
<FormField label="Permissions">
  <FormCheckboxGroup
    options={[
      { value: "read", label: "Read" },
      { value: "write", label: "Write" },
      { value: "delete", label: "Delete" },
    ]}
    value={form.values.permissions}
    onChange={(v) => form.setFieldValue("permissions", v)}
    showSelectAll
  />
</FormField>
```

## Radio Buttons

### Basic Radio Group

```tsx
<FormField label="Plan">
  <FormRadioGroup
    options={[
      { value: "free", label: "Free" },
      { value: "pro", label: "Pro" },
      { value: "enterprise", label: "Enterprise" },
    ]}
    value={form.values.plan}
    onChange={(v) => form.setFieldValue("plan", v)}
  />
</FormField>
```

### Card Style with Descriptions

```tsx
<FormRadioGroup
  options={[
    {
      value: "monthly",
      label: "Monthly",
      description: "$29/month, cancel anytime",
    },
    {
      value: "yearly",
      label: "Yearly",
      description: "$290/year, save 16%",
    },
  ]}
  value={form.values.billing}
  onChange={(v) => form.setFieldValue("billing", v)}
  cardStyle
/>
```

## File Upload

```tsx
<FormFileUpload
  acceptedTypes={["image/jpeg", "image/png", "application/pdf"]}
  maxSizeBytes={10 * 1024 * 1024}
  multiple
  showPreview
  onFilesSelected={(files) => {
    form.setFieldValue("files", files);
  }}
/>
```

## Dynamic Field Arrays

For repeating form sections like multiple addresses or contacts:

```tsx
const form = useForm({
  initialValues: {
    addresses: [{ street: "", city: "" }],
  },
  onSubmit: async (values) => {
    await api.submit(values);
  },
});

const addresses = useFieldArray(form, "addresses", {
  minItems: 1,
  maxItems: 5,
});

return (
  <>
    {addresses.fields.map((field, index) => (
      <div key={field.id} className="border p-4 rounded mb-4">
        <FormField label="Street">
          <FormInput {...form.register(`addresses.${index}.street`)} />
        </FormField>

        <FormField label="City">
          <FormInput {...form.register(`addresses.${index}.city`)} />
        </FormField>

        <button
          onClick={() => addresses.remove(index)}
          disabled={!addresses.canRemove(index)}
        >
          Remove
        </button>
      </div>
    ))}

    <button
      onClick={() => addresses.append({ street: "", city: "" })}
      disabled={!addresses.canAddMore}
    >
      Add Address
    </button>
  </>
);
```

## Validation Modes

### onChange (Real-time validation)

```tsx
const form = useForm({
  initialValues: { email: "" },
  validationMode: "onChange",
  validationSchema: (values) => {
    // Validates as user types
    return null;
  },
  onSubmit: async (values) => {},
});
```

### onBlur (Validate on blur)

```tsx
const form = useForm({
  initialValues: { email: "" },
  validationMode: "onBlur",
  validationSchema: (values) => {
    // Validates when field loses focus
    return null;
  },
  onSubmit: async (values) => {},
});
```

### onSubmit (Validate on submit)

```tsx
const form = useForm({
  initialValues: { email: "" },
  validationMode: "onSubmit",
  validationSchema: (values) => {
    // Validates only when form is submitted
    return null;
  },
  onSubmit: async (values) => {},
});
```

## Pre-built Validators

```tsx
import {
  emailSchema,
  passwordSchema,
  phoneSchema,
  urlSchema,
  slugSchema,
  dateRangeSchema,
  numericRangeSchema,
  fileSchema,
  addressSchema,
  companyInfoSchema,
  requiredSchema,
  minLengthSchema,
  maxLengthSchema,
  matchFieldSchema,
} from "@/lib/validation-schemas";

// Use in validation schema
validationSchema: (values) => {
  const errors: Record<string, string> = {};

  const emailError = emailSchema().validation(values.email);
  if (emailError) errors.email = emailError;

  const passwordError = passwordSchema(12).validation(values.password);
  if (passwordError) errors.password = passwordError;

  const phoneError = phoneSchema().validation(values.phone);
  if (phoneError) errors.phone = phoneError;

  return Object.keys(errors).length ? errors : null;
};
```

## Form State & Methods

```tsx
const form = useForm({
  /* config */
});

// State
form.values; // { email: '', password: '' }
form.errors; // { email: 'Email required' }
form.touched; // { email: true, password: false }
form.isDirty; // Record of which fields changed
form.isSubmitting; // Is form being submitted
form.isValidating; // Is async validation running
form.isValid; // Are all validations passing
form.isDirty; // Has any field changed

// Methods
form.handleSubmit; // Form submit handler
form.reset(); // Reset to initial values
form.setFieldValue("email", "test@example.com");
form.setFieldError("email", "Invalid email");
form.setFieldTouched("email", true);
```

## Styling & Theming

All components use `--wl-*` CSS variables from your dark theme. Override in your CSS:

```css
:root {
  --wl-primary-500: #3b82f6;
  --wl-primary-600: #2563eb;
  --wl-bg-surface: #1f2937;
  --wl-text-primary: #f3f4f6;
}
```

## Tips & Best Practices

1. **Always wrap inputs in FormField** for consistent styling
2. **Use the register() method** to connect fields to form state
3. **Validate on blur by default** for better UX
4. **Show errors only when touched** to avoid overwhelming users
5. **Use descriptive error messages** to help users fix issues
6. **Debounce search inputs** to reduce API calls
7. **Set maxLength on textarea** to prevent runaway submissions
8. **Use field arrays** for repeating sections instead of managing state manually
9. **Test async validation** thoroughly
10. **Provide visual feedback** for loading and submitting states

## Error Handling Example

```tsx
<form onSubmit={form.handleSubmit}>
  <FormField
    label="Email"
    required
    error={
      form.touched.email && form.errors.email ? form.errors.email : undefined
    }
    helperText="We'll send a confirmation email"
  >
    <FormInput
      {...form.register("email")}
      type="email"
      placeholder="you@example.com"
    />
  </FormField>

  <Button type="submit" disabled={form.isSubmitting || !form.isValid}>
    {form.isSubmitting ? "Submitting..." : "Submit"}
  </Button>
</form>
```
