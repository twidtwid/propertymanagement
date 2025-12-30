import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FileText, Upload, Search, FolderOpen } from "lucide-react"

export default function DocumentsPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Documents</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Store and organize your property documents
          </p>
        </div>
        <Button size="lg">
          <Upload className="h-5 w-5 mr-2" />
          Upload Document
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <div className="rounded-xl bg-blue-50 p-4 mb-4">
              <FolderOpen className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold">Property Deeds</h3>
            <p className="text-sm text-muted-foreground mt-1">10 documents</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <div className="rounded-xl bg-green-50 p-4 mb-4">
              <FolderOpen className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold">Insurance Policies</h3>
            <p className="text-sm text-muted-foreground mt-1">5 documents</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <div className="rounded-xl bg-amber-50 p-4 mb-4">
              <FolderOpen className="h-8 w-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold">Tax Records</h3>
            <p className="text-sm text-muted-foreground mt-1">12 documents</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <div className="rounded-xl bg-purple-50 p-4 mb-4">
              <FolderOpen className="h-8 w-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold">Contracts</h3>
            <p className="text-sm text-muted-foreground mt-1">8 documents</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Document storage will be available soon.
            <br />
            Documents can be uploaded and linked to properties, vehicles, bills, and policies.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
