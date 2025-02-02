// references:
// https://github.com/folz/hiasynth/tree/main/packages/editor/Editor
// https://codesandbox.io/s/typescript-lsp-c3mqx?file=/public/workers/tsserver.ts
// https://codesandbox.io/s/github/danilowoz/sandpack-tsserver?file=/src/sandpack-components/CodeEditor.tsx

import { EditorView } from "@codemirror/view";
import { useEffect, useRef } from "react";
import { setupExtensions } from "./setup-extensions";
// import { setEditorContents } from "../ipc/editor";

export const ScriptInline = ( {
    content,
    onChange,
}: {
    content: string;
    onChange: ( content: string ) => void;
} ) => {
    const divRef = useRef<HTMLDivElement>( null );
    const codeMirror = useRef<EditorView | null>( null );

    useEffect( () => {
        // setEditorContents( content );

        if ( divRef.current ) {
            codeMirror.current = new EditorView( {
                extensions: [ setupExtensions() ],
                parent: divRef.current,
                doc: content,
                dispatch: function ( transaction ) {
                    codeMirror.current!.update( [ transaction ] );
                    if ( transaction.docChanged ) {
                        // eslint-disable-next-line @typescript-eslint/no-base-to-string
                        const updatedContent = codeMirror.current!.state.doc.toString();
                        // setEditorContents( updatedContent );
                        onChange( updatedContent );
                    }
                },
            } );
        }
        return () => {
            codeMirror.current?.destroy();
        };
    }, [] );

    return <div ref={divRef}></div>;
};
