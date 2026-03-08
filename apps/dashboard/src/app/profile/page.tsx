"use client";

import { useState } from "react";
import { cn } from "../../lib/utils";
import { Header } from "../../components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
  Shield,
  LogOut,
  Clock,
  Globe,
  Lock,
  Smartphone,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";

interface Session {
  id: string;
  browser: string;
  platform: string;
  ip: string;
  location: string;
  lastActive: string;
  current: boolean;
}

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

  const [profile, setProfile] = useState({
    firstName: "Arjun",
    lastName: "Rajput",
    email: "arjun@witylogix.com",
    phone: "+1 (555) 123-4567",
    timezone: "America/New_York",
    role: "CTO",
  });

  const [editForm, setEditForm] = useState({ ...profile });

  const [passwordForm, setPasswordForm] = useState({
    current: "",
    new: "",
    confirm: "",
  });

  const [sessions, setSessions] = useState<Session[]>([
    {
      id: "1",
      browser: "Chrome",
      platform: "Mac OS",
      ip: "192.168.1.100",
      location: "San Francisco, CA",
      lastActive: "Just now",
      current: true,
    },
    {
      id: "2",
      browser: "Safari",
      platform: "iOS",
      ip: "192.168.1.101",
      location: "San Francisco, CA",
      lastActive: "2 hours ago",
      current: false,
    },
    {
      id: "3",
      browser: "Firefox",
      platform: "Ubuntu",
      ip: "192.168.1.102",
      location: "San Francisco, CA",
      lastActive: "3 days ago",
      current: false,
    },
  ]);

  const handleEditChange = (field: string, value: string) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveProfile = () => {
    setProfile(editForm);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditForm(profile);
    setIsEditing(false);
  };

  const handleChangePassword = () => {
    if (
      passwordForm.new &&
      passwordForm.new === passwordForm.confirm &&
      passwordForm.current
    ) {
      // In real app, would send to backend
      console.log("Password changed");
      setPasswordForm({ current: "", new: "", confirm: "" });
    }
  };

  const handleRevokeSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const handleRevokeAllSessions = () => {
    setSessions((prev) => [prev[0]]); // Keep only current session
  };

  const getInitials = () => {
    return `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase();
  };

  const cardStyle: CSSProperties = {
    marginBottom: "var(--wl-space-6)",
  };

  return (
    <div>
      <Header
        title="Profile Settings"
        subtitle="Manage your account and security preferences"
      />

      <div
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
          padding: "var(--wl-space-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--wl-space-6)",
        }}
      >
        {/* Profile Card */}
        <Card style={cardStyle}>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              style={{
                display: "flex",
                gap: "var(--wl-space-6)",
                marginBottom: "var(--wl-space-6)",
              }}
            >
              {/* Avatar */}
              <div>
                <div
                  style={{
                    width: "100px",
                    height: "100px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--wl-primary), #8b7dff)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--wl-text-inverse)",
                    fontSize: "var(--wl-text-3xl)",
                    fontWeight: 700,
                    boxShadow: "0 8px 24px rgba(108, 99, 255, 0.2)",
                  }}
                >
                  {getInitials()}
                </div>
                <button
                  style={{
                    marginTop: "var(--wl-space-3)",
                    padding: "var(--wl-space-2) var(--wl-space-3)",
                    borderRadius: "var(--wl-radius-md)",
                    border: "1px solid var(--wl-border)",
                    background: "transparent",
                    color: "var(--wl-text-muted)",
                    fontSize: "var(--wl-text-xs)",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Change Avatar
                </button>
              </div>

              {/* Profile Info */}
              <div style={{ flex: 1 }}>
                {!isEditing ? (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--wl-space-3)",
                        marginBottom: "var(--wl-space-4)",
                      }}
                    >
                      <div>
                        <h2
                          style={{
                            margin: "0 0 var(--wl-space-1) 0",
                            fontSize: "var(--wl-text-lg)",
                            fontWeight: 700,
                            color: "var(--wl-text)",
                          }}
                        >
                          {profile.firstName} {profile.lastName}
                        </h2>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "var(--wl-text-sm)",
                            color: "var(--wl-text-muted)",
                          }}
                        >
                          {profile.email}
                        </p>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "var(--wl-space-3)",
                        marginBottom: "var(--wl-space-4)",
                      }}
                    >
                      <Badge
                        style={{
                          background: "rgba(108, 99, 255, 0.1)",
                          color: "var(--wl-primary)",
                        }}
                      >
                        {profile.role}
                      </Badge>
                      <Badge
                        style={{
                          background: "rgba(34, 197, 94, 0.1)",
                          color: "#22c55e",
                        }}
                      >
                        Active
                      </Badge>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "var(--wl-space-4)",
                        fontSize: "var(--wl-text-xs)",
                        marginBottom: "var(--wl-space-4)",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            margin: "0 0 var(--wl-space-1) 0",
                            color: "var(--wl-text-muted)",
                          }}
                        >
                          Phone
                        </p>
                        <p
                          style={{
                            margin: 0,
                            color: "var(--wl-text)",
                            fontWeight: 500,
                          }}
                        >
                          {profile.phone}
                        </p>
                      </div>
                      <div>
                        <p
                          style={{
                            margin: "0 0 var(--wl-space-1) 0",
                            color: "var(--wl-text-muted)",
                          }}
                        >
                          Timezone
                        </p>
                        <p
                          style={{
                            margin: 0,
                            color: "var(--wl-text)",
                            fontWeight: 500,
                          }}
                        >
                          {profile.timezone}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setEditForm(profile);
                        setIsEditing(true);
                      }}
                      style={{
                        padding: "var(--wl-space-2) var(--wl-space-4)",
                        borderRadius: "var(--wl-radius-md)",
                        border: "1px solid var(--wl-primary)",
                        background: "transparent",
                        color: "var(--wl-primary)",
                        fontSize: "var(--wl-text-sm)",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Edit Profile
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--wl-space-3)",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "var(--wl-space-3)",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "var(--wl-text-xs)",
                            fontWeight: 500,
                            color: "var(--wl-text-muted)",
                            marginBottom: "var(--wl-space-1)",
                          }}
                        >
                          First Name
                        </label>
                        <input
                          type="text"
                          value={editForm.firstName}
                          onChange={(e) =>
                            handleEditChange("firstName", e.target.value)
                          }
                          style={{
                            width: "100%",
                            padding: "var(--wl-space-2) var(--wl-space-3)",
                            borderRadius: "var(--wl-radius-md)",
                            border: "1px solid var(--wl-border)",
                            background: "var(--wl-surface)",
                            color: "var(--wl-text)",
                            fontSize: "var(--wl-text-sm)",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "var(--wl-text-xs)",
                            fontWeight: 500,
                            color: "var(--wl-text-muted)",
                            marginBottom: "var(--wl-space-1)",
                          }}
                        >
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={editForm.lastName}
                          onChange={(e) =>
                            handleEditChange("lastName", e.target.value)
                          }
                          style={{
                            width: "100%",
                            padding: "var(--wl-space-2) var(--wl-space-3)",
                            borderRadius: "var(--wl-radius-md)",
                            border: "1px solid var(--wl-border)",
                            background: "var(--wl-surface)",
                            color: "var(--wl-text)",
                            fontSize: "var(--wl-text-sm)",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "var(--wl-text-xs)",
                          fontWeight: 500,
                          color: "var(--wl-text-muted)",
                          marginBottom: "var(--wl-space-1)",
                        }}
                      >
                        Email
                      </label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) =>
                          handleEditChange("email", e.target.value)
                        }
                        style={{
                          width: "100%",
                          padding: "var(--wl-space-2) var(--wl-space-3)",
                          borderRadius: "var(--wl-radius-md)",
                          border: "1px solid var(--wl-border)",
                          background: "var(--wl-surface)",
                          color: "var(--wl-text)",
                          fontSize: "var(--wl-text-sm)",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "var(--wl-space-3)",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "var(--wl-text-xs)",
                            fontWeight: 500,
                            color: "var(--wl-text-muted)",
                            marginBottom: "var(--wl-space-1)",
                          }}
                        >
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={editForm.phone}
                          onChange={(e) =>
                            handleEditChange("phone", e.target.value)
                          }
                          style={{
                            width: "100%",
                            padding: "var(--wl-space-2) var(--wl-space-3)",
                            borderRadius: "var(--wl-radius-md)",
                            border: "1px solid var(--wl-border)",
                            background: "var(--wl-surface)",
                            color: "var(--wl-text)",
                            fontSize: "var(--wl-text-sm)",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "var(--wl-text-xs)",
                            fontWeight: 500,
                            color: "var(--wl-text-muted)",
                            marginBottom: "var(--wl-space-1)",
                          }}
                        >
                          Timezone
                        </label>
                        <select
                          value={editForm.timezone}
                          onChange={(e) =>
                            handleEditChange("timezone", e.target.value)
                          }
                          style={{
                            width: "100%",
                            padding: "var(--wl-space-2) var(--wl-space-3)",
                            borderRadius: "var(--wl-radius-md)",
                            border: "1px solid var(--wl-border)",
                            background: "var(--wl-surface)",
                            color: "var(--wl-text)",
                            fontSize: "var(--wl-text-sm)",
                            boxSizing: "border-box",
                          }}
                        >
                          <option value="America/New_York">Eastern Time</option>
                          <option value="America/Chicago">Central Time</option>
                          <option value="America/Denver">Mountain Time</option>
                          <option value="America/Los_Angeles">
                            Pacific Time
                          </option>
                          <option value="Europe/London">GMT</option>
                          <option value="Europe/Paris">CET</option>
                          <option value="Asia/Tokyo">JST</option>
                        </select>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "var(--wl-space-3)",
                        marginTop: "var(--wl-space-3)",
                      }}
                    >
                      <button
                        onClick={handleSaveProfile}
                        style={{
                          padding: "var(--wl-space-2) var(--wl-space-4)",
                          borderRadius: "var(--wl-radius-md)",
                          border: "1px solid var(--wl-primary)",
                          background:
                            "linear-gradient(135deg, var(--wl-primary-500), var(--wl-primary-600))",
                          color: "var(--wl-text-inverse)",
                          fontSize: "var(--wl-text-sm)",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        style={{
                          padding: "var(--wl-space-2) var(--wl-space-4)",
                          borderRadius: "var(--wl-radius-md)",
                          border: "1px solid var(--wl-border)",
                          background: "transparent",
                          color: "var(--wl-text)",
                          fontSize: "var(--wl-text-sm)",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card style={cardStyle}>
          <CardHeader>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--wl-space-2)",
              }}
            >
              <Lock size={20} style={{ color: "var(--wl-primary)" }} />
              <CardTitle>Change Password</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--wl-space-4)",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "var(--wl-text-sm)",
                    fontWeight: 500,
                    color: "var(--wl-text)",
                    marginBottom: "var(--wl-space-2)",
                  }}
                >
                  Current Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your current password"
                    value={passwordForm.current}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        current: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      padding: "var(--wl-space-2) var(--wl-space-3)",
                      paddingRight: "var(--wl-space-5)",
                      borderRadius: "var(--wl-radius-md)",
                      border: "1px solid var(--wl-border)",
                      background: "var(--wl-surface)",
                      color: "var(--wl-text)",
                      fontSize: "var(--wl-text-sm)",
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "var(--wl-space-3)",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--wl-text-muted)",
                      padding: 0,
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "var(--wl-text-sm)",
                    fontWeight: 500,
                    color: "var(--wl-text)",
                    marginBottom: "var(--wl-space-2)",
                  }}
                >
                  New Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={passwordForm.new}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        new: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      padding: "var(--wl-space-2) var(--wl-space-3)",
                      paddingRight: "var(--wl-space-5)",
                      borderRadius: "var(--wl-radius-md)",
                      border: "1px solid var(--wl-border)",
                      background: "var(--wl-surface)",
                      color: "var(--wl-text)",
                      fontSize: "var(--wl-text-sm)",
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: "absolute",
                      right: "var(--wl-space-3)",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--wl-text-muted)",
                      padding: 0,
                    }}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "var(--wl-text-sm)",
                    fontWeight: 500,
                    color: "var(--wl-text)",
                    marginBottom: "var(--wl-space-2)",
                  }}
                >
                  Confirm Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={passwordForm.confirm}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        confirm: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      padding: "var(--wl-space-2) var(--wl-space-3)",
                      paddingRight: "var(--wl-space-5)",
                      borderRadius: "var(--wl-radius-md)",
                      border: "1px solid var(--wl-border)",
                      background: "var(--wl-surface)",
                      color: "var(--wl-text)",
                      fontSize: "var(--wl-text-sm)",
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: "absolute",
                      right: "var(--wl-space-3)",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--wl-text-muted)",
                      padding: 0,
                    }}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>
              </div>

              {passwordForm.new &&
                passwordForm.confirm &&
                passwordForm.new !== passwordForm.confirm && (
                  <div
                    style={{
                      padding: "var(--wl-space-3)",
                      borderRadius: "var(--wl-radius-md)",
                      background: "rgba(239, 68, 68, 0.05)",
                      color: "#ef4444",
                      fontSize: "var(--wl-text-xs)",
                    }}
                  >
                    Passwords do not match
                  </div>
                )}

              <button
                onClick={handleChangePassword}
                disabled={
                  !passwordForm.current ||
                  !passwordForm.new ||
                  passwordForm.new !== passwordForm.confirm
                }
                style={{
                  padding: "var(--wl-space-2) var(--wl-space-4)",
                  borderRadius: "var(--wl-radius-md)",
                  border: "1px solid var(--wl-primary)",
                  background:
                    passwordForm.current &&
                    passwordForm.new &&
                    passwordForm.new === passwordForm.confirm
                      ? "linear-gradient(135deg, var(--wl-primary-500), var(--wl-primary-600))"
                      : "var(--wl-surface)",
                  color:
                    passwordForm.current &&
                    passwordForm.new &&
                    passwordForm.new === passwordForm.confirm
                      ? "var(--wl-text-inverse)"
                      : "var(--wl-text-muted)",
                  fontSize: "var(--wl-text-sm)",
                  fontWeight: 600,
                  cursor:
                    passwordForm.current &&
                    passwordForm.new &&
                    passwordForm.new === passwordForm.confirm
                      ? "pointer"
                      : "not-allowed",
                  opacity:
                    passwordForm.current &&
                    passwordForm.new &&
                    passwordForm.new === passwordForm.confirm
                      ? 1
                      : 0.5,
                }}
              >
                Update Password
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Two-Factor Authentication Card */}
        <Card style={cardStyle}>
          <CardHeader>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--wl-space-2)",
              }}
            >
              <Smartphone size={20} style={{ color: "var(--wl-primary)" }} />
              <CardTitle>Two-Factor Authentication</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "var(--wl-space-4)",
              }}
            >
              <div>
                <p
                  style={{
                    margin: "0 0 var(--wl-space-1) 0",
                    fontSize: "var(--wl-text-sm)",
                    fontWeight: 500,
                    color: "var(--wl-text)",
                  }}
                >
                  Two-Factor Authentication
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--wl-text-xs)",
                    color: "var(--wl-text-muted)",
                  }}
                >
                  Add an extra layer of security to your account
                </p>
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={twoFAEnabled}
                  onChange={(e) => setTwoFAEnabled(e.target.checked)}
                  style={{
                    appearance: "none",
                    width: "44px",
                    height: "24px",
                    borderRadius: "12px",
                    border: "1px solid var(--wl-border)",
                    background: twoFAEnabled
                      ? "var(--wl-primary)"
                      : "var(--wl-surface)",
                    cursor: "pointer",
                    position: "relative",
                    transition: "background 0.2s",
                  }}
                />
              </label>
            </div>

            {twoFAEnabled && (
              <div
                style={{
                  padding: "var(--wl-space-4)",
                  borderRadius: "var(--wl-radius-md)",
                  background: "rgba(108, 99, 255, 0.05)",
                  borderLeft: "3px solid var(--wl-primary)",
                }}
              >
                <p
                  style={{
                    margin: "0 0 var(--wl-space-2) 0",
                    fontSize: "var(--wl-text-sm)",
                    fontWeight: 500,
                    color: "var(--wl-text)",
                  }}
                >
                  Authenticator App
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--wl-text-xs)",
                    color: "var(--wl-text-muted)",
                    lineHeight: 1.5,
                  }}
                >
                  Use an authenticator app like Google Authenticator or Microsoft
                  Authenticator to generate verification codes.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Sessions Card */}
        <Card style={cardStyle}>
          <CardHeader>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--wl-space-2)",
                }}
              >
                <Globe size={20} style={{ color: "var(--wl-primary)" }} />
                <CardTitle>Active Sessions</CardTitle>
              </div>
              <button
                onClick={handleRevokeAllSessions}
                style={{
                  padding: "var(--wl-space-1) var(--wl-space-3)",
                  borderRadius: "var(--wl-radius-sm)",
                  border: "1px solid var(--wl-border)",
                  background: "transparent",
                  color: "var(--wl-text-muted)",
                  fontSize: "var(--wl-text-xs)",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Sign out all
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--wl-space-4)",
              }}
            >
              {sessions.map((session) => (
                <div
                  key={session.id}
                  style={{
                    padding: "var(--wl-space-4)",
                    borderRadius: "var(--wl-radius-md)",
                    border: "1px solid var(--wl-border)",
                    background: session.current ? "rgba(108, 99, 255, 0.05)" : "var(--wl-surface)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "var(--wl-space-3)",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--wl-space-2)",
                          marginBottom: "var(--wl-space-2)",
                        }}
                      >
                        <h4
                          style={{
                            margin: 0,
                            fontSize: "var(--wl-text-sm)",
                            fontWeight: 600,
                            color: "var(--wl-text)",
                          }}
                        >
                          {session.browser} on {session.platform}
                        </h4>
                        {session.current && (
                          <Badge
                            style={{
                              background: "rgba(108, 99, 255, 0.15)",
                              color: "var(--wl-primary)",
                              fontSize: "var(--wl-text-xs)",
                            }}
                          >
                            Current
                          </Badge>
                        )}
                      </div>
                      <p
                        style={{
                          margin: "0 0 var(--wl-space-1) 0",
                          fontSize: "var(--wl-text-xs)",
                          color: "var(--wl-text-muted)",
                        }}
                      >
                        {session.location}
                      </p>
                      <p
                        style={{
                          margin: "0 0 var(--wl-space-1) 0",
                          fontSize: "var(--wl-text-xs)",
                          color: "var(--wl-text-muted)",
                        }}
                      >
                        IP: {session.ip}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "var(--wl-text-xs)",
                          color: "var(--wl-text-muted)",
                        }}
                      >
                        Last active: {session.lastActive}
                      </p>
                    </div>
                    {!session.current && (
                      <button
                        onClick={() => handleRevokeSession(session.id)}
                        style={{
                          padding: "var(--wl-space-2) var(--wl-space-3)",
                          borderRadius: "var(--wl-radius-sm)",
                          border: "1px solid var(--wl-border)",
                          background: "transparent",
                          color: "var(--wl-text-muted)",
                          fontSize: "var(--wl-text-xs)",
                          fontWeight: 500,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <LogOut size={14} style={{ marginRight: "var(--wl-space-1)" }} />
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card
          style={{
            ...cardStyle,
            borderColor: "#ef4444",
            borderWidth: "1px",
          }}
        >
          <CardHeader>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--wl-space-2)",
              }}
            >
              <AlertTriangle size={20} style={{ color: "#ef4444" }} />
              <CardTitle style={{ color: "#ef4444" }}>Danger Zone</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {!showDeleteConfirm ? (
              <div>
                <p
                  style={{
                    margin: "0 0 var(--wl-space-3) 0",
                    fontSize: "var(--wl-text-sm)",
                    color: "var(--wl-text-muted)",
                  }}
                >
                  Once you delete your account, there is no going back. Please
                  be certain.
                </p>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{
                    padding: "var(--wl-space-2) var(--wl-space-4)",
                    borderRadius: "var(--wl-radius-md)",
                    border: "1px solid #ef4444",
                    background: "rgba(239, 68, 68, 0.1)",
                    color: "#ef4444",
                    fontSize: "var(--wl-text-sm)",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Delete Account
                </button>
              </div>
            ) : (
              <div
                style={{
                  padding: "var(--wl-space-4)",
                  borderRadius: "var(--wl-radius-md)",
                  background: "rgba(239, 68, 68, 0.05)",
                  borderLeft: "3px solid #ef4444",
                }}
              >
                <p
                  style={{
                    margin: "0 0 var(--wl-space-3) 0",
                    fontSize: "var(--wl-text-sm)",
                    fontWeight: 600,
                    color: "#ef4444",
                  }}
                >
                  Are you absolutely sure?
                </p>
                <p
                  style={{
                    margin: "0 0 var(--wl-space-4) 0",
                    fontSize: "var(--wl-text-xs)",
                    color: "var(--wl-text-muted)",
                  }}
                >
                  This action cannot be undone. Your account and all associated
                  data will be permanently deleted.
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "var(--wl-space-3)",
                  }}
                >
                  <button
                    onClick={() => {
                      console.log("Account deleted");
                      setShowDeleteConfirm(false);
                    }}
                    style={{
                      padding: "var(--wl-space-2) var(--wl-space-4)",
                      borderRadius: "var(--wl-radius-md)",
                      border: "1px solid #ef4444",
                      background: "#ef4444",
                      color: "white",
                      fontSize: "var(--wl-text-sm)",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Yes, Delete My Account
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{
                      padding: "var(--wl-space-2) var(--wl-space-4)",
                      borderRadius: "var(--wl-radius-md)",
                      border: "1px solid var(--wl-border)",
                      background: "transparent",
                      color: "var(--wl-text)",
                      fontSize: "var(--wl-text-sm)",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
