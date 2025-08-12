import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  api, 
  type ClaudeSettings,
  type ClaudeInstallation
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { ClaudeVersionSelector } from "./ClaudeVersionSelector";
import { StorageTab } from "./StorageTab";
import { HooksEditor } from "./HooksEditor";
import { SlashCommandsManager } from "./SlashCommandsManager";
import { LanguageSelector } from "./LanguageSelector";
import { useTranslation } from "@/hooks/useTranslation";
import { useTheme } from "@/contexts/ThemeContext";
import ProviderManager from "./ProviderManager";

interface SettingsProps {
  /**
   * Callback to go back to the main view
   */
  onBack: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

interface PermissionRule {
  id: string;
  value: string;
}

interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

/**
 * 全面的设置界面，用于管理 Claude Code 设置
 * 提供无代码界面来编辑 settings.json 文件
 * Comprehensive Settings UI for managing Claude Code settings
 * Provides a no-code interface for editing the settings.json file
 */
export const Settings: React.FC<SettingsProps> = ({
  onBack,
  className,
}) => {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<ClaudeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("general");
  const [currentBinaryPath, setCurrentBinaryPath] = useState<string | null>(null);
  const [selectedInstallation, setSelectedInstallation] = useState<ClaudeInstallation | null>(null);
  const [binaryPathChanged, setBinaryPathChanged] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Custom Claude path state
  const [customClaudePath, setCustomClaudePath] = useState<string>("");
  const [isCustomPathMode, setIsCustomPathMode] = useState(false);
  const [customPathError, setCustomPathError] = useState<string | null>(null);
  
  // Permission rules state
  const [allowRules, setAllowRules] = useState<PermissionRule[]>([]);
  const [denyRules, setDenyRules] = useState<PermissionRule[]>([]);
  
  // Environment variables state
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([]);
  
  
  // Hooks state
  const [userHooksChanged, setUserHooksChanged] = useState(false);
  const getUserHooks = React.useRef<(() => any) | null>(null);
  
  // 挂载时加载设置
  // Load settings on mount
  useEffect(() => {
    loadSettings();
    loadClaudeBinaryPath();
  }, []);

  /**
   * 加载当前 Claude 二进制文件路径
   * Loads the current Claude binary path
   */
  const loadClaudeBinaryPath = async () => {
    try {
      const path = await api.getClaudeBinaryPath();
      setCurrentBinaryPath(path);
    } catch (err) {
      console.error("Failed to load Claude binary path:", err);
    }
  };

  /**
   * Handle setting custom Claude CLI path
   */
  const handleSetCustomPath = async () => {
    if (!customClaudePath.trim()) {
      setCustomPathError("请输入有效的路径");
      return;
    }

    try {
      setCustomPathError(null);
      await api.setCustomClaudePath(customClaudePath.trim());
      
      // Reload the current path to reflect changes
      await loadClaudeBinaryPath();
      
      // Clear the custom path field and exit custom mode
      setCustomClaudePath("");
      setIsCustomPathMode(false);
      
      // Show success message
      setToast({ message: t('common.customClaudePathSet'), type: "success" });
      
      // Trigger status refresh
      window.dispatchEvent(new CustomEvent('validate-claude-installation'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('common.setCustomPathFailed');
      setCustomPathError(errorMessage);
    }
  };

  /**
   * Handle clearing custom Claude CLI path
   */
  const handleClearCustomPath = async () => {
    try {
      await api.clearCustomClaudePath();
      
      // Reload the current path to reflect changes
      await loadClaudeBinaryPath();
      
      // Exit custom mode
      setIsCustomPathMode(false);
      setCustomClaudePath("");
      setCustomPathError(null);
      
      // Show success message
      setToast({ message: t('common.backToAutoDetect'), type: "success" });
      
      // Trigger status refresh
      window.dispatchEvent(new CustomEvent('validate-claude-installation'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('common.clearCustomPathFailed');
      setToast({ message: errorMessage, type: "error" });
    }
  };

  /**
   * Loads the current Claude settings
   */
  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedSettings = await api.getClaudeSettings();
      
      // Ensure loadedSettings is an object
      if (!loadedSettings || typeof loadedSettings !== 'object') {
        console.warn("Loaded settings is not an object:", loadedSettings);
        setSettings({});
        return;
      }
      
      setSettings(loadedSettings);

      // Parse permissions
      if (loadedSettings.permissions && typeof loadedSettings.permissions === 'object') {
        if (Array.isArray(loadedSettings.permissions.allow)) {
          setAllowRules(
            loadedSettings.permissions.allow.map((rule: string, index: number) => ({
              id: `allow-${index}`,
              value: rule,
            }))
          );
        }
        if (Array.isArray(loadedSettings.permissions.deny)) {
          setDenyRules(
            loadedSettings.permissions.deny.map((rule: string, index: number) => ({
              id: `deny-${index}`,
              value: rule,
            }))
          );
        }
      }

      // Parse environment variables
      if (loadedSettings.env && typeof loadedSettings.env === 'object' && !Array.isArray(loadedSettings.env)) {
        setEnvVars(
          Object.entries(loadedSettings.env).map(([key, value], index) => ({
            id: `env-${index}`,
            key,
            value: value as string,
            enabled: true, // 默认启用所有现有的环境变量
          }))
        );
      }

    } catch (err) {
      console.error("Failed to load settings:", err);
      setError(t('common.loadingProjects'));
      setSettings({});
    } finally {
      setLoading(false);
    }
  };

  /**
   * Saves the current settings
   */
  const saveSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      setToast(null);

      // Build the settings object
      const updatedSettings: ClaudeSettings = {
        ...settings,
        permissions: {
          allow: allowRules.map(rule => rule.value).filter(v => v.trim()),
          deny: denyRules.map(rule => rule.value).filter(v => v.trim()),
        },
        env: envVars
          .filter(envVar => envVar.enabled) // 只保存启用的环境变量
          .reduce((acc, { key, value }) => {
            if (key.trim() && value.trim()) {
              acc[key] = value;
            }
            return acc;
          }, {} as Record<string, string>),
      };

      await api.saveClaudeSettings(updatedSettings);
      setSettings(updatedSettings);

      // Save Claude binary path if changed
      if (binaryPathChanged && selectedInstallation) {
        await api.setClaudeBinaryPath(selectedInstallation.path);
        setCurrentBinaryPath(selectedInstallation.path);
        setBinaryPathChanged(false);
      }

      // Save user hooks if changed
      if (userHooksChanged && getUserHooks.current) {
        const hooks = getUserHooks.current();
        await api.updateHooksConfig('user', hooks);
        setUserHooksChanged(false);
      }

      setToast({ message: t('common.settingsSaved'), type: "success" });
    } catch (err) {
      console.error("Failed to save settings:", err);
      setError(t('common.saveSettingsFailed'));
      setToast({ message: t('common.saveSettingsFailed'), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Updates a simple setting value
   */
  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  /**
   * Adds a new permission rule
   */
  const addPermissionRule = (type: "allow" | "deny") => {
    const newRule: PermissionRule = {
      id: `${type}-${Date.now()}`,
      value: "",
    };
    
    if (type === "allow") {
      setAllowRules(prev => [...prev, newRule]);
    } else {
      setDenyRules(prev => [...prev, newRule]);
    }
  };

  /**
   * Updates a permission rule
   */
  const updatePermissionRule = (type: "allow" | "deny", id: string, value: string) => {
    if (type === "allow") {
      setAllowRules(prev => prev.map(rule => 
        rule.id === id ? { ...rule, value } : rule
      ));
    } else {
      setDenyRules(prev => prev.map(rule => 
        rule.id === id ? { ...rule, value } : rule
      ));
    }
  };

  /**
   * Removes a permission rule
   */
  const removePermissionRule = (type: "allow" | "deny", id: string) => {
    if (type === "allow") {
      setAllowRules(prev => prev.filter(rule => rule.id !== id));
    } else {
      setDenyRules(prev => prev.filter(rule => rule.id !== id));
    }
  };

  /**
   * Adds a new environment variable
   */
  const addEnvVar = () => {
    const newVar: EnvironmentVariable = {
      id: `env-${Date.now()}`,
      key: "",
      value: "",
      enabled: true, // 默认启用新的环境变量
    };
    setEnvVars(prev => [...prev, newVar]);
  };

  /**
   * Updates an environment variable
   */
  const updateEnvVar = (id: string, field: "key" | "value" | "enabled", value: string | boolean) => {
    setEnvVars(prev => prev.map(envVar => 
      envVar.id === id ? { ...envVar, [field]: value } : envVar
    ));
  };

  /**
   * Removes an environment variable
   */
  const removeEnvVar = (id: string) => {
    setEnvVars(prev => prev.filter(envVar => envVar.id !== id));
  };

  /**
   * Handle Claude installation selection
   */
  const handleClaudeInstallationSelect = (installation: ClaudeInstallation) => {
    setSelectedInstallation(installation);
    setBinaryPathChanged(installation.path !== currentBinaryPath);
  };

  return (
    <div className={cn("flex flex-col h-full bg-background text-foreground", className)}>
      <div className="max-w-4xl mx-auto w-full flex flex-col h-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between p-4 border-b border-border"
        >
        <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{t('settings.title')}</h2>
          <p className="text-xs text-muted-foreground">
              {t('common.configureClaudePreferences')}
          </p>
          </div>
        </div>
        
        <Button
          onClick={saveSettings}
          disabled={saving || loading}
          size="sm"
          className="gap-2 bg-primary hover:bg-primary/90"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.savingSettings')}
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {t('common.saveSettings')}
            </>
          )}
        </Button>
      </motion.div>
      
      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/50 flex items-center gap-2 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-10 w-full">
              <TabsTrigger value="general">{t('settings.general')}</TabsTrigger>
              <TabsTrigger value="permissions">{t('common.permissions')}</TabsTrigger>
              <TabsTrigger value="environment">{t('common.environment')}</TabsTrigger>
              <TabsTrigger value="advanced">{t('common.advanced')}</TabsTrigger>
              <TabsTrigger value="hooks">{t('common.hooks')}</TabsTrigger>
              <TabsTrigger value="commands">{t('common.commands')}</TabsTrigger>
              <TabsTrigger value="provider">{t('common.provider')}</TabsTrigger>
              <TabsTrigger value="storage">{t('settings.storage')}</TabsTrigger>
            </TabsList>
            
            {/* General Settings */}
            <TabsContent value="general" className="space-y-6">
              <Card className="p-6 space-y-6">
                <div>
                  <h3 className="text-base font-semibold mb-4">{t('settings.general')}</h3>
                  
                  <div className="space-y-4">
                    {/* Language Selector */}
                    <LanguageSelector />


                    {/* Theme Selector */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5 flex-1">
                        <Label htmlFor="theme">{t('settings.theme')}</Label>
                        <p className="text-xs text-muted-foreground">
                          {t('settings.themeDescription')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={theme === 'light' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setTheme('light')}
                        >
                          {t('settings.themeLight')}
                        </Button>
                        <Button
                          variant={theme === 'dark' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setTheme('dark')}
                        >
                          {t('settings.themeDark')}
                        </Button>
                      </div>
                    </div>

                    {/* Show System Initialization Info */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5 flex-1">
                        <Label htmlFor="showSystemInit">{t('common.showSystemInit')}</Label>
                        <p className="text-xs text-muted-foreground">
                          {t('common.showSystemInitDesc')}
                        </p>
                      </div>
                      <Switch
                        id="showSystemInit"
                        checked={settings?.showSystemInitialization !== false}
                        onCheckedChange={(checked) => updateSetting("showSystemInitialization", checked)}
                      />
                    </div>

                    {/* Include Co-authored By */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5 flex-1">
                        <Label htmlFor="coauthored">{t('common.includeCoAuthored')}</Label>
                        <p className="text-xs text-muted-foreground">
                          {t('common.includeCoAuthoredDesc')}
                        </p>
                      </div>
                      <Switch
                        id="coauthored"
                        checked={settings?.includeCoAuthoredBy !== false}
                        onCheckedChange={(checked) => updateSetting("includeCoAuthoredBy", checked)}
                      />
                    </div>
                    
                    {/* Verbose Output */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5 flex-1">
                        <Label htmlFor="verbose">{t('common.verboseOutput')}</Label>
                        <p className="text-xs text-muted-foreground">
                          {t('common.verboseOutputDesc')}
                        </p>
                      </div>
                      <Switch
                        id="verbose"
                        checked={settings?.verbose === true}
                        onCheckedChange={(checked) => updateSetting("verbose", checked)}
                      />
                    </div>
                    
                    {/* Cleanup Period */}
                    <div className="space-y-2">
                      <Label htmlFor="cleanup">{t('common.chatRetentionDays')}</Label>
                      <Input
                        id="cleanup"
                        type="number"
                        min="1"
                        placeholder="30"
                        value={settings?.cleanupPeriodDays || ""}
                        onChange={(e) => {
                          const value = e.target.value ? parseInt(e.target.value) : undefined;
                          updateSetting("cleanupPeriodDays", value);
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('common.chatRetentionDesc')}
                      </p>
                    </div>
                    
                    {/* Claude Binary Path Selector */}
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium mb-2 block">{t('common.claudeInstallation')}</Label>
                        <p className="text-xs text-muted-foreground mb-4">
                          {t('common.claudeInstallationDesc')}
                        </p>
                      </div>
                      <ClaudeVersionSelector
                        selectedPath={currentBinaryPath}
                        onSelect={handleClaudeInstallationSelect}
                      />
                      {binaryPathChanged && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          {t('common.binaryPathChanged')}
                        </p>
                      )}
                    </div>

                    {/* Custom Claude Path Configuration */}
                    <div className="space-y-4">
                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <Label className="text-sm font-medium">{t('common.customPath')}</Label>
                            <p className="text-xs text-muted-foreground">
                              {t('common.customPathDesc')}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsCustomPathMode(!isCustomPathMode);
                              setCustomPathError(null);
                              setCustomClaudePath("");
                            }}
                          >
                            {isCustomPathMode ? t('common.cancel') : t('common.setCustomPath')}
                          </Button>
                        </div>

                        <AnimatePresence>
                          {isCustomPathMode && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-3"
                            >
                              <div className="space-y-2">
                                <Input
                                  placeholder={t('common.pathToClaudeCli')}
                                  value={customClaudePath}
                                  onChange={(e) => {
                                    setCustomClaudePath(e.target.value);
                                    setCustomPathError(null);
                                  }}
                                  className={cn(customPathError && "border-red-500")}
                                />
                                {customPathError && (
                                  <p className="text-xs text-red-500">{customPathError}</p>
                                )}
                              </div>
                              
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={handleSetCustomPath}
                                  disabled={!customClaudePath.trim()}
                                >
                                  {t('common.setCustomPath')}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleClearCustomPath}
                                >
                                  {t('common.restoreAutoDetect')}
                                </Button>
                              </div>
                              
                              <div className="p-3 bg-muted rounded-md">
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <p className="text-xs text-muted-foreground">
                                      <strong>{t('common.currentPath')}:</strong> {currentBinaryPath || t('common.notDetected')}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {t('common.customPathValidation')}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>
            
            {/* Permissions Settings */}
            <TabsContent value="permissions" className="space-y-6">
              <Card className="p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-semibold mb-2">{t('common.permissionRules')}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t('common.permissionRulesDesc')}
                    </p>
                  </div>
                  
                  {/* Allow Rules */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-green-500">{t('common.allowRules')}</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addPermissionRule("allow")}
                        className="gap-2 hover:border-green-500/50 hover:text-green-500"
                      >
                        <Plus className="h-3 w-3" />
                        {t('common.addRule')}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {allowRules.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">
                          {t('common.noAllowRules')}
                        </p>
                      ) : (
                        allowRules.map((rule) => (
                          <motion.div
                            key={rule.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-2"
                          >
                            <Input
                              placeholder={t('common.bashExample')}
                              value={rule.value}
                              onChange={(e) => updatePermissionRule("allow", rule.id, e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removePermissionRule("allow", rule.id)}
                              className="h-8 w-8"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  {/* Deny Rules */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-red-500">{t('common.denyRules')}</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addPermissionRule("deny")}
                        className="gap-2 hover:border-red-500/50 hover:text-red-500"
                      >
                        <Plus className="h-3 w-3" />
                        {t('common.addRule')}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {denyRules.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">
                          {t('common.noDenyRules')}
                        </p>
                      ) : (
                        denyRules.map((rule) => (
                          <motion.div
                            key={rule.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-2"
                          >
                            <Input
                              placeholder="e.g., Bash(curl:*)"
                              value={rule.value}
                              onChange={(e) => updatePermissionRule("deny", rule.id, e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removePermissionRule("deny", rule.id)}
                              className="h-8 w-8"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  <div className="pt-2 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      <strong>{t('common.examples')}</strong>
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                      <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Bash</code> - {t('common.allowAllBash')}</li>
                      <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Bash(npm run build)</code> - {t('common.allowExactCommand')}</li>
                      <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Bash(npm run test:*)</code> - {t('common.allowPrefixCommand')}</li>
                      <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Read(~/.zshrc)</code> - {t('common.allowReadFile')}</li>
                      <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Edit(docs/**)</code> - {t('common.allowEditFiles')}</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </TabsContent>
            
            {/* Environment Variables */}
            <TabsContent value="environment" className="space-y-6">
              <Card className="p-6">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold">{t('common.envVariables')}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('common.envVariablesDesc')}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addEnvVar}
                      className="gap-2"
                    >
                      <Plus className="h-3 w-3" />
                      {t('common.addVariable')}
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {envVars.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        {t('common.noEnvVariables')}
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground mb-3">
                          {t('common.envVariablesTip')}
                        </p>
                        {envVars.map((envVar) => (
                          <motion.div
                            key={envVar.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-2"
                          >
                            {/* 启用/禁用开关 */}
                            <div className="flex items-center">
                              <Switch
                                checked={envVar.enabled}
                                onCheckedChange={(checked) => updateEnvVar(envVar.id, "enabled", checked)}
                                title={envVar.enabled ? t('common.disableEnvVar') : t('common.enableEnvVar')}
                                className="scale-75"
                              />
                            </div>
                            
                            <Input
                              placeholder="KEY"
                              value={envVar.key}
                              onChange={(e) => updateEnvVar(envVar.id, "key", e.target.value)}
                              className={`flex-1 font-mono text-sm ${!envVar.enabled ? 'opacity-50' : ''}`}
                              disabled={!envVar.enabled}
                            />
                            <span className={`text-muted-foreground ${!envVar.enabled ? 'opacity-50' : ''}`}>=</span>
                            <Input
                              placeholder="value"
                              value={envVar.value}
                              onChange={(e) => updateEnvVar(envVar.id, "value", e.target.value)}
                              className={`flex-1 font-mono text-sm ${!envVar.enabled ? 'opacity-50' : ''}`}
                              disabled={!envVar.enabled}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeEnvVar(envVar.id)}
                              className="h-8 w-8 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </motion.div>
                        ))}
                      </>
                    )}
                  </div>
                  
                  <div className="pt-2 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      <strong>{t('common.commonVariables')}</strong>
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                      <li>• <code className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">CLAUDE_CODE_ENABLE_TELEMETRY</code> - {t('common.enableTelemetry')}</li>
                      <li>• <code className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">ANTHROPIC_MODEL</code> - {t('common.customModel')}</li>
                      <li>• <code className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">DISABLE_COST_WARNINGS</code> - {t('common.disableCostWarnings')}</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </TabsContent>
            {/* Advanced Settings */}
            <TabsContent value="advanced" className="space-y-6">
              <Card className="p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-semibold mb-4">{t('common.advancedSettings')}</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      {t('common.advancedSettingsDesc')}
                    </p>
                  </div>
                  
                  {/* API Key Helper */}
                  <div className="space-y-2">
                    <Label htmlFor="apiKeyHelper">{t('common.apiKeyHelper')}</Label>
                    <Input
                      id="apiKeyHelper"
                      placeholder="/path/to/generate_api_key.sh"
                      value={settings?.apiKeyHelper || ""}
                      onChange={(e) => updateSetting("apiKeyHelper", e.target.value || undefined)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('common.apiKeyHelperDesc')}
                    </p>
                  </div>
                  
                  {/* Raw JSON Editor */}
                  <div className="space-y-2">
                    <Label>{t('common.rawSettings')}</Label>
                    <div className="p-3 rounded-md bg-muted font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                      <pre>{JSON.stringify(settings, null, 2)}</pre>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('common.rawSettingsDesc')}
                    </p>
                  </div>
                </div>
              </Card>
            </TabsContent>
            
            {/* Hooks Settings */}
            <TabsContent value="hooks" className="space-y-6">
              <Card className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold mb-2">{t('common.userHooks')}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t('common.userHooksDesc')}
                    </p>
                  </div>
                  
                  <HooksEditor
                    key={activeTab}
                    scope="user"
                    className="border-0"
                    hideActions={true}
                    onChange={(hasChanges, getHooks) => {
                      setUserHooksChanged(hasChanges);
                      getUserHooks.current = getHooks;
                    }}
                  />
                </div>
              </Card>
            </TabsContent>
            
            {/* Commands Tab */}
            <TabsContent value="commands">
              <Card className="p-6">
                <SlashCommandsManager className="p-0" />
              </Card>
            </TabsContent>
            
            {/* Provider Tab */}
            <TabsContent value="provider">
              <ProviderManager onBack={() => {}} />
            </TabsContent>
            
            
            {/* Storage Tab */}
            <TabsContent value="storage">
              <StorageTab />
            </TabsContent>
          </Tabs>
        </div>
      )}
      </div>
      
      {/* Toast Notification */}
      <ToastContainer>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </ToastContainer>
    </div>
  );
}; 
