package com.bryan.donas.data

import android.content.Context
import androidx.core.content.ContextCompat
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CredentialManagerCallback
import androidx.credentials.exceptions.ClearCredentialException
import com.google.firebase.auth.FirebaseAuth

object FirebaseCredentialState {
    fun signOut(context: Context) {
        FirebaseAuth.getInstance().signOut()
        CredentialManager.create(context).clearCredentialStateAsync(ClearCredentialStateRequest(), null,
            ContextCompat.getMainExecutor(context), object : CredentialManagerCallback<Void?, ClearCredentialException> {
                override fun onResult(result: Void?) = Unit
                // Firebase is already signed out. The Google chooser requires an explicit selection.
                override fun onError(e: ClearCredentialException) = Unit
            })
    }
}
