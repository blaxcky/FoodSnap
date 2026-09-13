package io.github.blaxcky.foodsnap;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.UriPermission;
import android.net.Uri;
import android.webkit.MimeTypeMap;
import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "PhotoFolder")
public class PhotoFolderPlugin extends Plugin {
    private static final String PREFERENCES = "foodsnap_photo_folder";
    private static final String URI_KEY = "tree_uri";
    private static final String NAME_KEY = "tree_name";
    private final ExecutorService fileExecutor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void selectDirectory(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION |
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION |
            Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "directorySelected");
    }

    @ActivityCallback
    private void directorySelected(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("Directory selection cancelled", "CANCELLED");
            return;
        }

        Uri uri = data.getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            );
            DocumentFile directory = DocumentFile.fromTreeUri(getContext(), uri);
            String name = directory != null && directory.getName() != null
                ? directory.getName() : "Selected folder";
            String previousValue = preferences().getString(URI_KEY, null);
            if (previousValue != null && !previousValue.equals(uri.toString())) {
                try {
                    getContext().getContentResolver().releasePersistableUriPermission(
                        Uri.parse(previousValue),
                        Intent.FLAG_GRANT_READ_URI_PERMISSION
                    );
                } catch (SecurityException ignored) {
                    // The old grant may already have been revoked by Android or the document provider.
                }
            }
            preferences().edit().putString(URI_KEY, uri.toString()).putString(NAME_KEY, name).apply();
            JSObject response = new JSObject();
            response.put("uri", uri.toString());
            response.put("name", name);
            call.resolve(response);
        } catch (SecurityException error) {
            call.reject("Android did not grant lasting read access", "PERMISSION_DENIED", error);
        }
    }

    @PluginMethod
    public void getDirectoryStatus(PluginCall call) {
        String value = preferences().getString(URI_KEY, null);
        JSObject response = new JSObject();
        response.put("configured", value != null);
        response.put("permissionGranted", false);
        if (value == null) {
            call.resolve(response);
            return;
        }

        Uri uri = Uri.parse(value);
        boolean granted = hasPersistedReadPermission(uri);
        DocumentFile directory = granted ? DocumentFile.fromTreeUri(getContext(), uri) : null;
        granted = granted && directory != null && directory.exists() && directory.isDirectory() && directory.canRead();
        response.put("permissionGranted", granted);
        response.put("uri", value);
        response.put("name", preferences().getString(NAME_KEY, "Selected folder"));
        call.resolve(response);
    }

    @PluginMethod
    public void listImages(PluginCall call) {
        String value = preferences().getString(URI_KEY, null);
        if (value == null) {
            call.reject("No photo folder is configured", "NOT_CONFIGURED");
            return;
        }
        Uri uri = Uri.parse(value);
        if (!hasPersistedReadPermission(uri)) {
            call.reject("Photo folder access was revoked", "PERMISSION_DENIED");
            return;
        }

        fileExecutor.execute(() -> {
            try {
                DocumentFile root = DocumentFile.fromTreeUri(getContext(), uri);
                if (root == null || !root.exists() || !root.canRead()) {
                    call.reject("The selected photo folder is unavailable", "PERMISSION_DENIED");
                    return;
                }
                JSArray images = new JSArray();
                appendImages(root, "", images);
                JSObject response = new JSObject();
                response.put("images", images);
                call.resolve(response);
            } catch (SecurityException error) {
                call.reject("Photo folder access was revoked", "PERMISSION_DENIED", error);
            } catch (Exception error) {
                call.reject("The photo folder could not be read", "READ_FAILED", error);
            }
        });
    }

    private void appendImages(DocumentFile directory, String parentPath, JSArray images) {
        for (DocumentFile entry : directory.listFiles()) {
            String name = entry.getName() == null ? "unnamed" : entry.getName();
            String relativePath = parentPath.isEmpty() ? name : parentPath + "/" + name;
            if (entry.isDirectory()) {
                appendImages(entry, relativePath, images);
            } else if (entry.isFile() && isImage(entry, name)) {
                JSObject image = new JSObject();
                image.put("uri", entry.getUri().toString());
                image.put("relativePath", relativePath);
                image.put("mimeType", entry.getType() == null ? "" : entry.getType());
                image.put("size", entry.length());
                image.put("lastModified", entry.lastModified());
                images.put(image);
            }
        }
    }

    private boolean isImage(DocumentFile file, String name) {
        String type = file.getType();
        if (type != null && type.startsWith("image/")) return true;
        String extension = MimeTypeMap.getFileExtensionFromUrl(name).toLowerCase(Locale.ROOT);
        return extension.matches("avif|bmp|gif|heic|heif|jpe|jpeg|jpg|png|webp");
    }

    private boolean hasPersistedReadPermission(Uri target) {
        for (UriPermission permission : getContext().getContentResolver().getPersistedUriPermissions()) {
            if (permission.isReadPermission() && permission.getUri().equals(target)) return true;
        }
        return false;
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    @Override
    protected void handleOnDestroy() {
        fileExecutor.shutdownNow();
    }
}
