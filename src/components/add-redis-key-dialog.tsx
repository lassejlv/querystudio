import { useState } from "react";
import { Plus, Trash2, FileType, Hash, Database, Binary, Clock, Braces } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { api } from "@/lib/api";

export type RedisKeyType = "string" | "hash" | "list" | "set" | "zset" | "json";

interface AddRedisKeyDialogProps {
  connectionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface HashField {
  key: string;
  value: string;
}

interface ZSetMember {
  member: string;
  score: number;
}

const keyTypeOptions: { value: RedisKeyType; label: string; icon: React.ReactNode }[] = [
  { value: "string", label: "String", icon: <FileType className="h-4 w-4" /> },
  { value: "hash", label: "Hash", icon: <Hash className="h-4 w-4" /> },
  { value: "list", label: "List", icon: <Database className="h-4 w-4" /> },
  { value: "set", label: "Set", icon: <Binary className="h-4 w-4" /> },
  { value: "zset", label: "Sorted Set", icon: <Clock className="h-4 w-4" /> },
  { value: "json", label: "JSON", icon: <Braces className="h-4 w-4" /> },
];

export function AddRedisKeyDialog({
  connectionId,
  open,
  onOpenChange,
  onSuccess,
}: AddRedisKeyDialogProps) {
  const [keyName, setKeyName] = useState("");
  const [keyType, setKeyType] = useState<RedisKeyType>("string");
  const [ttl, setTtl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("form");

  // String value
  const [stringValue, setStringValue] = useState("");

  // Hash fields
  const [hashFields, setHashFields] = useState<HashField[]>([{ key: "", value: "" }]);

  // List items
  const [listItems, setListItems] = useState<string[]>([""]);

  // Set members
  const [setMembers, setSetMembers] = useState<string[]>([""]);

  // ZSet members
  const [zsetMembers, setZsetMembers] = useState<ZSetMember[]>([{ member: "", score: 0 }]);

  // JSON value
  const [jsonValue, setJsonValue] = useState("{}");

  const resetForm = () => {
    setKeyName("");
    setKeyType("string");
    setTtl("");
    setStringValue("");
    setHashFields([{ key: "", value: "" }]);
    setListItems([""]);
    setSetMembers([""]);
    setZsetMembers([{ member: "", score: 0 }]);
    setJsonValue("{}");
    setActiveTab("form");
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const validateForm = (): boolean => {
    if (!keyName.trim()) {
      toast.error("Key name is required");
      return false;
    }

    switch (keyType) {
      case "string":
        if (!stringValue) {
          toast.error("String value is required");
          return false;
        }
        break;
      case "hash":
        if (hashFields.every((f) => !f.key || !f.value)) {
          toast.error("At least one hash field is required");
          return false;
        }
        break;
      case "list":
        if (listItems.every((item) => !item)) {
          toast.error("At least one list item is required");
          return false;
        }
        break;
      case "set":
        if (setMembers.every((member) => !member)) {
          toast.error("At least one set member is required");
          return false;
        }
        break;
      case "zset":
        if (zsetMembers.every((m) => !m.member)) {
          toast.error("At least one sorted set member is required");
          return false;
        }
        break;
      case "json":
        try {
          JSON.parse(jsonValue);
        } catch {
          toast.error("Invalid JSON value");
          return false;
        }
        break;
    }

    return true;
  };

  const buildValue = (): unknown => {
    switch (keyType) {
      case "string":
        return stringValue;
      case "hash":
        return hashFields
          .filter((f) => f.key && f.value)
          .reduce((acc, f) => ({ ...acc, [f.key]: f.value }), {});
      case "list":
        return listItems.filter((item) => item);
      case "set":
        return setMembers.filter((member) => member);
      case "zset":
        return zsetMembers
          .filter((m) => m.member)
          .map((m) => ({ member: m.member, score: m.score }));
      case "json":
        return JSON.parse(jsonValue);
      default:
        return null;
    }
  };

  const generateCommand = (): string => {
    const value = buildValue();
    const ttlValue = ttl ? parseInt(ttl, 10) : null;

    switch (keyType) {
      case "string":
        return `SET "${keyName}" "${value}"${ttlValue ? ` EX ${ttlValue}` : ""}`;
      case "hash": {
        const fields = Object.entries(value as Record<string, string>)
          .map(([k, v]) => `"${k}" "${v}"`)
          .join(" ");
        return `HSET "${keyName}" ${fields}`;
      }
      case "list": {
        const items = (value as string[]).map((i) => `"${i}"`).join(" ");
        return `RPUSH "${keyName}" ${items}`;
      }
      case "set": {
        const members = (value as string[]).map((m) => `"${m}"`).join(" ");
        return `SADD "${keyName}" ${members}`;
      }
      case "zset": {
        const members = (value as { member: string; score: number }[])
          .map((m) => `${m.score} "${m.member}"`)
          .join(" ");
        return `ZADD "${keyName}" ${members}`;
      }
      case "json":
        return `JSON.SET "${keyName}" $ '${JSON.stringify(value)}'`;
      default:
        return "";
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const value = buildValue();
      const ttlValue = ttl ? parseInt(ttl, 10) : null;

      await api.createRedisKey(connectionId, keyName, keyType, value, ttlValue);
      toast.success(`Key "${keyName}" created successfully`);
      onSuccess?.();
      handleClose();
    } catch (error) {
      toast.error(`Failed to create key: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Hash field handlers
  const addHashField = () => {
    setHashFields([...hashFields, { key: "", value: "" }]);
  };

  const updateHashField = (index: number, field: "key" | "value", value: string) => {
    const newFields = [...hashFields];
    newFields[index][field] = value;
    setHashFields(newFields);
  };

  const removeHashField = (index: number) => {
    if (hashFields.length > 1) {
      setHashFields(hashFields.filter((_, i) => i !== index));
    }
  };

  // List item handlers
  const addListItem = () => {
    setListItems([...listItems, ""]);
  };

  const updateListItem = (index: number, value: string) => {
    const newItems = [...listItems];
    newItems[index] = value;
    setListItems(newItems);
  };

  const removeListItem = (index: number) => {
    if (listItems.length > 1) {
      setListItems(listItems.filter((_, i) => i !== index));
    }
  };

  // Set member handlers
  const addSetMember = () => {
    setSetMembers([...setMembers, ""]);
  };

  const updateSetMember = (index: number, value: string) => {
    const newMembers = [...setMembers];
    newMembers[index] = value;
    setSetMembers(newMembers);
  };

  const removeSetMember = (index: number) => {
    if (setMembers.length > 1) {
      setSetMembers(setMembers.filter((_, i) => i !== index));
    }
  };

  // ZSet member handlers
  const addZsetMember = () => {
    setZsetMembers([...zsetMembers, { member: "", score: 0 }]);
  };

  const updateZsetMember = (index: number, field: "member" | "score", value: string | number) => {
    const newMembers = [...zsetMembers];
    newMembers[index][field] = value as never;
    setZsetMembers(newMembers);
  };

  const removeZsetMember = (index: number) => {
    if (zsetMembers.length > 1) {
      setZsetMembers(zsetMembers.filter((_, i) => i !== index));
    }
  };

  const renderValueInput = () => {
    switch (keyType) {
      case "string":
        return (
          <div className="space-y-2">
            <Label htmlFor="string-value">Value</Label>
            <Textarea
              id="string-value"
              value={stringValue}
              onChange={(e) => setStringValue(e.target.value)}
              placeholder="Enter string value..."
              className="min-h-[100px] font-mono"
            />
          </div>
        );

      case "hash":
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Fields</Label>
              <Button type="button" variant="outline" size="sm" onClick={addHashField}>
                <Plus className="h-4 w-4 mr-1" />
                Add Field
              </Button>
            </div>
            <ScrollArea className="h-[200px] border rounded-md p-2">
              <div className="space-y-2">
                {hashFields.map((field, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Field name"
                      value={field.key}
                      onChange={(e) => updateHashField(index, "key", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Value"
                      value={field.value}
                      onChange={(e) => updateHashField(index, "value", e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeHashField(index)}
                      disabled={hashFields.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        );

      case "list":
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items (in order)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addListItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
            <ScrollArea className="h-[200px] border rounded-md p-2">
              <div className="space-y-2">
                {listItems.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="flex items-center text-sm text-muted-foreground w-8">
                      {index + 1}.
                    </span>
                    <Input
                      placeholder="Item value"
                      value={item}
                      onChange={(e) => updateListItem(index, e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeListItem(index)}
                      disabled={listItems.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        );

      case "set":
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Members</Label>
              <Button type="button" variant="outline" size="sm" onClick={addSetMember}>
                <Plus className="h-4 w-4 mr-1" />
                Add Member
              </Button>
            </div>
            <ScrollArea className="h-[200px] border rounded-md p-2">
              <div className="space-y-2">
                {setMembers.map((member, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Member value"
                      value={member}
                      onChange={(e) => updateSetMember(index, e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSetMember(index)}
                      disabled={setMembers.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        );

      case "zset":
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Members with Scores</Label>
              <Button type="button" variant="outline" size="sm" onClick={addZsetMember}>
                <Plus className="h-4 w-4 mr-1" />
                Add Member
              </Button>
            </div>
            <ScrollArea className="h-[200px] border rounded-md p-2">
              <div className="space-y-2">
                {zsetMembers.map((member, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="number"
                      step="any"
                      placeholder="Score"
                      value={member.score}
                      onChange={(e) =>
                        updateZsetMember(index, "score", parseFloat(e.target.value) || 0)
                      }
                      className="w-24"
                    />
                    <Input
                      placeholder="Member"
                      value={member.member}
                      onChange={(e) => updateZsetMember(index, "member", e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeZsetMember(index)}
                      disabled={zsetMembers.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        );

      case "json":
        return (
          <div className="space-y-2">
            <Label htmlFor="json-value">JSON Value</Label>
            <Textarea
              id="json-value"
              value={jsonValue}
              onChange={(e) => setJsonValue(e.target.value)}
              placeholder='{"key": "value"}'
              className="min-h-[200px] font-mono text-xs"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add New Redis Key</DialogTitle>
          <DialogDescription>Create a new key in the Redis database</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="form">Form</TabsTrigger>
            <TabsTrigger value="preview">Command Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="form" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="key-name">Key Name</Label>
                <Input
                  id="key-name"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="my:key"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="key-type">Key Type</Label>
                <Select value={keyType} onValueChange={(v) => setKeyType(v as RedisKeyType)}>
                  <SelectTrigger id="key-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {keyTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          {option.icon}
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ttl">
                TTL (seconds) <span className="text-muted-foreground">- optional</span>
              </Label>
              <Input
                id="ttl"
                type="number"
                min="0"
                value={ttl}
                onChange={(e) => setTtl(e.target.value)}
                placeholder="Leave empty for no expiration"
              />
            </div>

            {renderValueInput()}
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <div className="space-y-2">
              <Label>Redis Command</Label>
              <div className="bg-muted rounded-md p-4 font-mono text-sm overflow-x-auto">
                <code>{keyName ? generateCommand() : "Fill in the form to see the command"}</code>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
