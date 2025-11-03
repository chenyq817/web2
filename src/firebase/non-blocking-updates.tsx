'use client';
    
import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import {FirestorePermissionError} from '@/firebase/errors';

/**
 * Initiates a setDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options: SetOptions) {
  setDoc(docRef, data, options).catch(error => {
    const contextualError = new FirestorePermissionError({
        operation: 'write',
        path: docRef.path,
        requestResourceData: data,
    });
    errorEmitter.emit('permission-error', contextualError);
  })
}


/**
 * Initiates an addDoc operation for a collection reference.
 * Does NOT await the write operation internally.
 * Returns the Promise for the new doc ref, but typically not awaited by caller.
 */
export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  addDoc(colRef, data)
    .catch(error => {
      const contextualError = new FirestorePermissionError({
          operation: 'create',
          path: colRef.path,
          requestResourceData: data,
      });
      errorEmitter.emit('permission-error', contextualError);
    });
}


/**
 * Initiates an updateDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  updateDoc(docRef, data)
    .catch(error => {
       const contextualError = new FirestorePermissionError({
           operation: 'update',
           path: docRef.path,
           requestResourceData: data,
       });
       errorEmitter.emit('permission-error', contextualError);
    });
}


/**
 * Initiates a deleteDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  deleteDoc(docRef)
    .catch(error => {
      const contextualError = new FirestorePermissionError({
          operation: 'delete',
          path: docRef.path,
      });
      errorEmitter.emit('permission-error', contextualError);
    });
}
