import { typeboxResolver } from '@hookform/resolvers/typebox';
import { Static, Type } from '@sinclair/typebox';
import { useMutation, useQuery } from '@tanstack/react-query';
import { HttpStatusCode } from 'axios';
import { t } from 'i18next';
import { Plus, X } from 'lucide-react';
import pako from 'pako';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { CreateTagDialog } from '@/app/routes/platform/setup/pieces/create-tag-dialog';
import { ApMarkdown } from '@/components/custom/markdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { piecesTagsApi } from '@/features/platform-admin/lib/pieces-tags';
import { flagsHooks } from '@/hooks/flags-hooks';
import { platformHooks } from '@/hooks/platform-hooks';
import { api } from '@/lib/api';
import {
  AddPieceRequestBody,
  ApFlagId,
  PackageType,
  PieceScope,
} from '@activepieces/shared';

import { piecesApi } from '../lib/pieces-api';
const FormSchema = Type.Object(
  {
    packageType: Type.Enum(PackageType),
    pieceName: Type.Optional(Type.String()),
    scope: Type.Enum(PieceScope),
    pieceVersion: Type.Optional(Type.String()),
    pieceArchive: Type.Optional(Type.Any()),
    tags: Type.Optional(Type.Array(Type.String())),
  },
  {
    errorMessage: {
      required: t('Please select a package type'),
    },
  },
);

type InstallPieceDialogProps = {
  onInstallPiece: () => void;
  scope: PieceScope;
};
const InstallPieceDialog = ({
  onInstallPiece,
  scope,
}: InstallPieceDialogProps) => {
  const { platform } = platformHooks.useCurrentPlatform();
  const isEnabled = platform.plan.managePiecesEnabled;
  const [isOpen, setIsOpen] = useState(false);
  const [tagsPopoverOpen, setTagsPopoverOpen] = useState(false);
  const [createTagDialogOpen, setCreateTagDialogOpen] = useState(false);

  const { data: privatePiecesEnabled } = flagsHooks.useFlag<boolean>(
    ApFlagId.PRIVATE_PIECES_ENABLED,
  );

  const { data: availableTags = [], refetch: refetchTags } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const response = await piecesTagsApi.list({ limit: 100 });
      return response.data;
    },
  });

  const form = useForm<Static<typeof FormSchema>>({
    resolver: typeboxResolver(FormSchema),
    defaultValues: {
      scope,
      packageType: PackageType.REGISTRY,
      tags: [],
    },
  });

  const handleArchiveUpload = async (file: File) => {
    if (file && file.name.endsWith('.tgz')) {
      try {
        const fileBuffer = await file.arrayBuffer();
        const decompressedData = pako.ungzip(new Uint8Array(fileBuffer));
        const text = new TextDecoder().decode(decompressedData);

        // Look for package.json content in the decompressed data
        const packageJsonMatch = text.match(
          /package\.json.*?{[^}]*"name"\s*:\s*"([^"]+)".*?"version"\s*:\s*"([^"]+)"/s,
        );
        if (packageJsonMatch) {
          form.setValue('pieceName', packageJsonMatch[1]);
          form.setValue('pieceVersion', packageJsonMatch[2]);
        } else {
          form.setError('pieceArchive', {
            message: t('package.json not found in archive'),
          });
        }
      } catch (error) {
        console.error('Error processing file:', error);
        form.setError('pieceArchive', {
          message: t('Error processing archive file'),
        });
      }
    } else {
      form.setError('pieceArchive', {
        message: t('Please upload a .tgz file'),
      });
    }
  };

  const { mutate, isPending } = useMutation<void, Error, AddPieceRequestBody>({
    mutationFn: async (data) => {
      form.clearErrors();

      if (data.packageType === PackageType.REGISTRY) {
        if (!data.pieceName) {
          form.setError('pieceName', {
            message: t('Piece name is required for NPM Registry'),
          });
        }
        if (!data.pieceVersion) {
          form.setError('pieceVersion', {
            message: t('Piece version is required for NPM Registry'),
          });
        }
        if (!data.pieceName || !data.pieceVersion) {
          return;
        }
      }

      await piecesApi.install(data);
    },
    onSuccess: () => {
      setIsOpen(false);
      form.reset();
      onInstallPiece();
      toast.success(t('Piece installed'), {
        duration: 3000,
      });
    },
    onError: (error) => {
      if (api.isError(error)) {
        switch (error.response?.status) {
          case HttpStatusCode.Conflict:
            form.setError('root.serverError', {
              message: t(
                'A piece with this name and version is already installed. Please update the version number in package.json and try again.',
              ),
            });
            break;
          default:
            form.setError('root.serverError', {
              message: t('Something went wrong, please try again later'),
            });
            break;
        }
      }
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => setIsOpen(open)}>
      <DialogTrigger asChild>
        <Button size="sm" className="flex items-center justify-center gap-2">
          <Plus className="size-4" />
          {t('Install Piece')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Install a piece')}</DialogTitle>
          <DialogDescription>
            <ApMarkdown
              markdown={
                'Use this to install a [custom piece]("https://www.activepieces.com/docs/developers/building-pieces/create-action") that you (or someone else) created. Once the piece is installed, you can use it in the flow builder.\n\nWarning: Make sure you trust the author as the piece will have access to your flow data and it might not be compatible with the current version of Activepieces.'
              }
            />
          </DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit((data) =>
              mutate(data as AddPieceRequestBody),
            )}
          >
            <FormField
              name="packageType"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="packageType">
                    {t('Package Type')}
                  </FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value === PackageType.ARCHIVE) {
                        form.setValue('pieceName', undefined);
                        form.setValue('pieceVersion', undefined);
                      }
                      form.clearErrors();
                    }}
                    defaultValue={PackageType.REGISTRY}
                  >
                    <SelectTrigger>
                      <SelectValue defaultValue={PackageType.REGISTRY} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={PackageType.REGISTRY}>
                          {t('NPM Registry')}
                        </SelectItem>
                        <SelectItem
                          value={PackageType.ARCHIVE}
                          disabled={!isEnabled || !privatePiecesEnabled}
                        >
                          {t('Packed Archive (.tgz)')}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch('packageType') === PackageType.REGISTRY && (
              <>
                <FormField
                  name="pieceName"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="pieceName">
                        {t('Piece Name')}
                      </FormLabel>
                      <Input
                        {...field}
                        value={field.value || ''}
                        id="pieceName"
                        type="text"
                        placeholder="@activepieces/piece-name"
                        className="rounded-sm"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="pieceVersion"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="pieceVersion">
                        {t('Piece Version')}
                      </FormLabel>
                      <Input
                        {...field}
                        value={field.value || ''}
                        id="pieceVersion"
                        type="text"
                        placeholder="0.0.1"
                        className="rounded-sm"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {form.watch('packageType') === PackageType.ARCHIVE && (
              <FormField
                name="pieceArchive"
                control={form.control}
                render={({ field: { value, onChange, ...fieldProps } }) => (
                  <FormItem>
                    <FormLabel htmlFor="pieceArchive">
                      {t('Package Archive')}
                    </FormLabel>
                    <Input
                      {...fieldProps}
                      id="pieceArchive"
                      type="file"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          onChange(file);
                          handleArchiveUpload(file);
                        }
                      }}
                      placeholder={t('Package archive')}
                      className="rounded-sm"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              name="tags"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Tags (Optional)')}</FormLabel>
                  <div className="flex flex-col gap-2">
                    <Popover
                      open={tagsPopoverOpen}
                      onOpenChange={setTagsPopoverOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          type="button"
                        >
                          {t('Select tags...')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0" align="start">
                        <Command>
                          <CommandList>
                            {availableTags.length === 0 ? (
                              <CommandEmpty>{t('No tags created.')}</CommandEmpty>
                            ) : (
                              <ScrollArea viewPortClassName="max-h-[200px]">
                                <CommandGroup>
                                  {availableTags.map((tag) => {
                                    const isSelected = field.value?.includes(
                                      tag.name,
                                    );
                                    return (
                                      <CommandItem
                                        key={tag.id}
                                        onSelect={() => {
                                          const currentTags = field.value || [];
                                          if (isSelected) {
                                            field.onChange(
                                              currentTags.filter(
                                                (t) => t !== tag.name,
                                              ),
                                            );
                                          } else {
                                            field.onChange([
                                              ...currentTags,
                                              tag.name,
                                            ]);
                                          }
                                        }}
                                      >
                                        <div
                                          className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border ${
                                            isSelected
                                              ? 'bg-primary border-primary'
                                              : 'border-input'
                                          }`}
                                        >
                                          {isSelected && (
                                            <span className="text-primary-foreground text-xs">
                                              ✓
                                            </span>
                                          )}
                                        </div>
                                        <span>{tag.name}</span>
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </ScrollArea>
                            )}
                            <CreateTagDialog
                              onTagCreated={(tag) => {
                                refetchTags();
                                const currentTags = field.value || [];
                                field.onChange([...currentTags, tag.name]);
                              }}
                              isOpen={createTagDialogOpen}
                              setIsOpen={setCreateTagDialogOpen}
                            >
                              <CommandItem
                                className="justify-center text-center"
                                onSelect={() => {
                                  setCreateTagDialogOpen(true);
                                }}
                              >
                                + {t('New Tag')}
                              </CommandItem>
                            </CreateTagDialog>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {field.value && field.value.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {field.value.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="flex items-center gap-1"
                          >
                            {tag}
                            <X
                              className="h-3 w-3 cursor-pointer"
                              onClick={() => {
                                field.onChange(
                                  field.value?.filter((t) => t !== tag) || [],
                                );
                              }}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form?.formState?.errors?.root?.serverError && (
              <FormMessage>
                {form.formState.errors.root.serverError.message}
              </FormMessage>
            )}
            <Button loading={isPending} type="submit">
              {t('Install')}
            </Button>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
};

export { InstallPieceDialog };
