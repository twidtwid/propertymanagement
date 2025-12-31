import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { User, Bell, Shield, Users, Database, Mail, ArrowRight } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-lg text-muted-foreground mt-1">
          Manage your account and application preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" defaultValue="Anne" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue="anne@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" defaultValue="555-0100" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="flex items-center h-11">
                <Badge variant="secondary" className="text-base">Owner</Badge>
              </div>
            </div>
          </div>
          <Button>Save Changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Configure how you receive alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium">Payment Due Reminders</p>
              <p className="text-sm text-muted-foreground">
                Get notified before payments are due
              </p>
            </div>
            <Badge variant="success">Enabled</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium">Check Confirmation Alerts</p>
              <p className="text-sm text-muted-foreground">
                Alert when checks haven&apos;t been confirmed within 14 days
              </p>
            </div>
            <Badge variant="success">Enabled</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium">Insurance Expiration Warnings</p>
              <p className="text-sm text-muted-foreground">
                Remind before policies expire
              </p>
            </div>
            <Badge variant="success">Enabled</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-muted-foreground">
                Send critical alerts to your email
              </p>
            </div>
            <Badge variant="secondary">Disabled</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </CardTitle>
          <CardDescription>People with access to this account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-medium">
                  A
                </div>
                <div>
                  <p className="font-medium">Anne</p>
                  <p className="text-sm text-muted-foreground">anne@example.com</p>
                </div>
              </div>
              <Badge>Owner</Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-medium">
                  T
                </div>
                <div>
                  <p className="font-medium">Todd</p>
                  <p className="text-sm text-muted-foreground">todd@example.com</p>
                </div>
              </div>
              <Badge>Owner</Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-medium">
                  M
                </div>
                <div>
                  <p className="font-medium">Michael</p>
                  <p className="text-sm text-muted-foreground">michael@example.com</p>
                </div>
              </div>
              <Badge>Owner</Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-medium">
                  A
                </div>
                <div>
                  <p className="font-medium">Amelia</p>
                  <p className="text-sm text-muted-foreground">amelia@example.com</p>
                </div>
              </div>
              <Badge>Owner</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center font-medium">
                  B
                </div>
                <div>
                  <p className="font-medium">Barbara Brady</p>
                  <p className="text-sm text-muted-foreground">barbara@cbiz.com</p>
                </div>
              </div>
              <Badge variant="outline">Bookkeeper</Badge>
            </div>
          </div>
          <Button variant="outline" className="mt-4">
            <Mail className="h-4 w-4 mr-2" />
            Invite Team Member
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Gmail Integration
          </CardTitle>
          <CardDescription>Connect Gmail for vendor communications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium">Vendor Email Analysis</p>
              <p className="text-sm text-muted-foreground">
                Analyze vendor emails, track communications, get daily summaries
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/settings/gmail">
                Configure
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Management
          </CardTitle>
          <CardDescription>Export and backup your data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline">Export All Data (JSON)</Button>
          <Button variant="outline">Export for Accounting (CSV)</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>Manage security settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline">Change Password</Button>
          <Button variant="outline">Enable Two-Factor Authentication</Button>
        </CardContent>
      </Card>
    </div>
  )
}
