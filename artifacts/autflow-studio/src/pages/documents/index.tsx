import { useListDocuments, useListAllDocuments, useCreateDocument, useListClients, getListDocumentsQueryKey, getListAllDocumentsQueryKey, type ListClientsResponseItem } from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Filter, FileText, FileDown, Link as LinkIcon, Folder, Code, PenTool } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

const DOC_TYPES = [
  "contract",
  "invoice",
  "proposal",
  "design",
  "brand_assets",
  "link",
  "google_drive",
  "github",
  "figma",
  "other",
] as const;

function getDocIcon(type: string) {
  switch (type) {
    case "contract": return <FileText className="text-blue-500" />;
    case "invoice": return <FileDown className="text-amber-500" />;
    case "proposal": return <FileDown className="text-amber-500" />;
    case "design": return <PenTool className="text-pink-500" />;
    case "brand_assets": return <PenTool className="text-pink-500" />;
    case "github": return <Code className="text-foreground" />;
    case "figma": return <PenTool className="text-purple-500" />;
    case "google_drive": return <Folder className="text-emerald-500" />;
    default: return <LinkIcon className="text-muted-foreground" />;
  }
}

function AddDocumentDialog({
  open,
  onOpenChange,
  clientId: initialClientId,
  clients: allClients,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: number | null;
  clients?: ListClientsResponseItem[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { mutate: createDocument, isPending } = useCreateDocument();

  const [selectedClientId, setSelectedClientId] = useState<string>(
    initialClientId != null ? String(initialClientId) : ""
  );
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("link");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");

  const needsClientPicker = initialClientId === null;

  function resetForm() {
    setTitle("");
    setType("link");
    setUrl("");
    setNotes("");
    if (initialClientId != null) setSelectedClientId(String(initialClientId));
    else setSelectedClientId("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const resolvedClientId = needsClientPicker ? parseInt(selectedClientId, 10) : initialClientId!;
    if (!title.trim() || !resolvedClientId) return;
    createDocument(
      {
        clientId: resolvedClientId,
        data: {
          title: title.trim(),
          type: type as any,
          url: url.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          const resolvedId = needsClientPicker ? parseInt(selectedClientId, 10) : initialClientId!;
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey(resolvedId) });
          queryClient.invalidateQueries({ queryKey: getListAllDocumentsQueryKey() });
          toast({ title: "Document added", description: `"${title}" was added successfully.` });
          resetForm();
          onOpenChange(false);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to add document.", variant: "destructive" });
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Document</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {needsClientPicker && (
            <div className="space-y-1.5">
              <Label htmlFor="doc-client">Client *</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId} required>
                <SelectTrigger id="doc-client"><SelectValue placeholder="Select a client…" /></SelectTrigger>
                <SelectContent>
                  {allClients?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="doc-title">Title *</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Master Service Agreement"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="doc-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-url">URL (optional)</Label>
            <Input
              id="doc-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-notes">Notes (optional)</Label>
            <Textarea
              id="doc-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Cancel</Button>
            <Button type="submit" disabled={isPending || !title.trim() || (needsClientPicker && !selectedClientId)}>
              {isPending ? "Adding…" : "Add Document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function DocumentsList() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: clients, isLoading: clientsLoading } = useListClients();
  // "all" shows documents across every client; otherwise a specific client id (as a string)
  const [selectedClientId, setSelectedClientId] = useState<string>("all");

  const isAllClients = selectedClientId === "all";
  const effectiveClientId = isAllClients ? null : parseInt(selectedClientId, 10);

  const { data: clientDocuments, isLoading: clientDocsLoading } = useListDocuments(
    effectiveClientId ?? 0,
    { query: { enabled: !isAllClients && effectiveClientId !== null, queryKey: getListDocumentsQueryKey(effectiveClientId ?? 0) } }
  );
  const { data: allDocuments, isLoading: allDocsLoading } = useListAllDocuments(
    { query: { enabled: isAllClients, queryKey: getListAllDocumentsQueryKey() } }
  );

  const documents = isAllClients ? allDocuments : clientDocuments;

  const filteredDocs = documents?.filter((doc) => {
    const matchesSearch = !search || doc.title.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || doc.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const isLoading = clientsLoading || (isAllClients ? allDocsLoading : clientDocsLoading);
  // "Add Document" needs a specific client to attach the document to.
  const addDialogClientId = isAllClients ? (clients?.[0]?.id ?? null) : effectiveClientId;

  // No clients at all
  if (!clientsLoading && (!clients || clients.length === 0)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Documents" description="Central hub for all client assets, links, and files" />
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card/30 border-dashed">
          <h3 className="text-lg font-semibold mb-1">No clients yet</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            Add a client first to start managing documents.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Documents" description="Central hub for all client assets, links, and files">
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus size={16} />
          Add Document
        </Button>
      </PageHeader>

      <AddDocumentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={isAllClients ? null : effectiveClientId}
        clients={clients}
      />

      {/* Client selector */}
      {clients && clients.length > 0 && (
        <div className="flex items-center gap-3">
          <Label htmlFor="doc-client-select" className="text-sm font-medium shrink-0">Client</Label>
          <Select
            value={selectedClientId}
            onValueChange={setSelectedClientId}
          >
            <SelectTrigger id="doc-client-select" className="w-56 bg-card/50">
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            placeholder="Search documents..."
            className="pl-9 bg-card/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40 bg-card/50 gap-2">
              <Filter size={14} className="text-muted-foreground shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {DOC_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-card/40 animate-pulse border border-border/50" />
          ))}
        </div>
      ) : !filteredDocs || filteredDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card/30 border-dashed">
          <h3 className="text-lg font-semibold mb-1">No documents found</h3>
          <p className="text-muted-foreground text-sm max-w-sm mb-6">
            {search || typeFilter !== "all"
              ? "No documents match your filters."
              : isAllClients
                ? "No documents yet across any client."
                : "No documents for this client yet."}
          </p>
          {!search && typeFilter === "all" && (
            <Button onClick={() => setDialogOpen(true)}>Add Document</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="p-4 rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm hover:border-primary/50 transition-colors cursor-pointer group flex items-start gap-4"
              onClick={() => { if (doc.url) window.open(doc.url, "_blank", "noreferrer"); }}
            >
              <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                {getDocIcon(doc.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{doc.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {clients?.find((c) => c.id === doc.clientId)?.companyName ?? ""}
                </p>
                <div className="text-[10px] text-muted-foreground font-mono mt-3 uppercase tracking-wider">
                  {doc.type.replace("_", " ")} • {format(new Date(doc.createdAt), "MMM d, yyyy")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
