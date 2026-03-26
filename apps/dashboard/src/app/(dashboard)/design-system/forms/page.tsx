"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Textarea, Select, Checkbox } from "@/components/ui";

export default function FormsPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    country: "",
    message: "",
    agreeTerms: false,
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const finalValue =
      type === "checkbox" ? (e.target as HTMLInputElement).checked : value;

    setFormData((prev) => ({
      ...prev,
      [name]: finalValue,
    }));

    // Clear error for this field
    setValidationErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      errors.fullName = "Full name is required";
    }

    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Invalid email format";
    }

    if (!formData.country) {
      errors.country = "Please select a country";
    }

    if (!formData.message.trim()) {
      errors.message = "Message is required";
    } else if (formData.message.length < 10) {
      errors.message = "Message must be at least 10 characters";
    }

    if (!formData.agreeTerms) {
      errors.agreeTerms = "You must agree to the terms";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      alert("Form submitted successfully!");
      setFormData({
        fullName: "",
        email: "",
        country: "",
        message: "",
        agreeTerms: false,
      });
    }
  };

  const handleReset = () => {
    setFormData({
      fullName: "",
      email: "",
      country: "",
      message: "",
      agreeTerms: false,
    });
    setValidationErrors({});
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="border-b border-[#1e1e2e]">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-bold text-white mb-2">
            Form Components
          </h1>
          <p className="text-gray-300 max-w-2xl">
            Complete showcase of form components with validation states, accessibility
            features, and real-world usage patterns.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        {/* Form Components Overview */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">
            Available Form Components
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Input</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300 space-y-2">
                <p>Text input with label, error, and hint support</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Sizes: sm, md, lg</li>
                  <li>Error state styling</li>
                  <li>Helper text support</li>
                  <li>Icon support</li>
                  <li>Password type support</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Textarea</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300 space-y-2">
                <p>Multi-line text input for longer content</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Auto-resizable height</li>
                  <li>Minimum height: 80px</li>
                  <li>Label support</li>
                  <li>Error validation states</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Select</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300 space-y-2">
                <p>Dropdown select component</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Label support</li>
                  <li>Placeholder text</li>
                  <li>Error states</li>
                  <li>Disabled state</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Checkbox & Switch</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300 space-y-2">
                <p>Boolean input components</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Checkbox for multiple selections</li>
                  <li>Switch for toggles</li>
                  <li>Accessible labels</li>
                  <li>Disabled states</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Complete Form Example */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">
            Complete Form Example
          </h2>

          <Card>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Full Name */}
                <Input
                  label="Full Name *"
                  name="fullName"
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  error={validationErrors.fullName}
                  hint="Enter your first and last name"
                />

                {/* Email */}
                <Input
                  label="Email Address *"
                  name="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  error={validationErrors.email}
                  hint="We'll never share your email"
                />

                {/* Country Select */}
                <Select
                  label="Country *"
                  name="country"
                  options={[
                    { value: "us", label: "United States" },
                    { value: "ca", label: "Canada" },
                    { value: "uk", label: "United Kingdom" },
                    { value: "au", label: "Australia" },
                    { value: "other", label: "Other" },
                  ]}
                  placeholder="Select your country"
                  value={formData.country}
                  onChange={handleInputChange}
                  error={validationErrors.country}
                />

                {/* Message Textarea */}
                <Textarea
                  label="Message *"
                  name="message"
                  placeholder="Your message here... (minimum 10 characters)"
                  value={formData.message}
                  onChange={handleInputChange}
                  error={validationErrors.message}
                />

                {/* Terms Checkbox */}
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      name="agreeTerms"
                      checked={formData.agreeTerms}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                    <label className="text-sm text-gray-300 leading-relaxed">
                      I agree to the terms and conditions and privacy policy *
                    </label>
                  </div>
                  {validationErrors.agreeTerms && (
                    <span className="text-xs text-red-500">
                      {validationErrors.agreeTerms}
                    </span>
                  )}
                </div>

                {/* Form Actions */}
                <div className="flex gap-3 pt-4 border-t border-[#1e1e2e]">
                  <Button
                    type="submit"
                    variant="primary"
                  >
                    Submit Form
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleReset}
                  >
                    Clear Form
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>

        {/* Validation States */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">
            Validation States
          </h2>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Valid State</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  label="Email Address"
                  placeholder="john@example.com"
                  value="john@example.com"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Invalid State</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  label="Email Address"
                  placeholder="john@example.com"
                  value="invalid-email"
                  error="Please enter a valid email address"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Warning State</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value="weak"
                  hint="Password is weak. Use uppercase, numbers, and symbols"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Disabled State</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  label="Locked Field"
                  value="This field is locked"
                  disabled
                />
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Accessibility Features */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">
            Accessibility Features
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Labels</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300 space-y-2">
                <p>
                  All form inputs have associated labels using the label prop
                </p>
                <p>
                  Labels are properly connected to inputs for screen readers
                </p>
                <p>
                  Labels have font-semibold for visual hierarchy
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Error Messages</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300 space-y-2">
                <p>
                  Error messages use color and icon, not color alone
                </p>
                <p>
                  Error text is associated with input for screen readers
                </p>
                <p>
                  Errors appear below input field consistently
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Focus Management</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300 space-y-2">
                <p>
                  All inputs have visible focus indicators
                </p>
                <p>
                  Focus outline uses --blue-500 color
                </p>
                <p>
                  Tab order follows logical form structure
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Helper Text</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300 space-y-2">
                <p>
                  Hint text provides context without overwhelming users
                </p>
                <p>
                  Helper text is associated with input
                </p>
                <p>
                  Text uses secondary color for visual distinction
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Input Types */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">
            Input Types
          </h2>

          <div className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <Input
                  label="Text Input"
                  type="text"
                  placeholder="Basic text input"
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <Input
                  label="Email Input"
                  type="email"
                  placeholder="user@example.com"
                  hint="Use email format: user@example.com"
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <Input
                  label="Password Input"
                  type="password"
                  placeholder="••••••••"
                  hint="Minimum 8 characters"
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <Input
                  label="Number Input"
                  type="number"
                  placeholder="Enter a number"
                  min="0"
                  max="100"
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <Input
                  label="Search Input"
                  type="search"
                  placeholder="Search..."
                />
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Best Practices */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">
            Form Best Practices
          </h2>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Labels are Required</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300">
                Always use the label prop on inputs. Use an asterisk (*) for required fields.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Clear Error Messages</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300">
                Error messages should be specific and actionable. Tell users what went wrong and how to fix it.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Provide Helper Text</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300">
                Use the hint prop to provide context. For email fields, explain that it will be kept private.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Group Related Fields</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300">
                Use whitespace and card sections to group logically related form fields together.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Validate on Blur and Submit</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300">
                Validate individual fields on blur, then validate the entire form on submit. Use the error prop to display messages.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Disable Submit While Loading</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300">
                Always disable the submit button while the form is being submitted to prevent duplicate submissions.
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
